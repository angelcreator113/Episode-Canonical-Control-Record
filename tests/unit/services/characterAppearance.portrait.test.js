'use strict';

/**
 * Portraits that come back black (Evoni, 2026-10-17: "portrait photos are
 * now showing black after the 3rd one"). Flux Pro's filter sends an
 * all-black image when it flags one. Such an image is never kept: one more
 * try, then an error that says so. Remove drops a portrait. The image
 * service and storage are mocked; the images are real, made with sharp.
 */
jest.mock('../../../src/services/imageGenerationService', () => ({ generateImage: jest.fn() }));
jest.mock('../../../src/services/pulseImageService', () => ({ storePulseImage: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));

const sharp = require('sharp');
const axios = require('axios');
const { generateImage } = require('../../../src/services/imageGenerationService');
const { storePulseImage } = require('../../../src/services/pulseImageService');
const { generatePortrait, removePortrait, isBlank, AppearanceError } = require('../../../src/services/characterAppearance');

const jpeg = (rgb) => sharp({ create: { width: 64, height: 64, channels: 3, background: rgb } }).jpeg().toBuffer();
const character = (extra = {}) => ({
  id: 'c1', display_name: 'Velvet', appearance: { summary: 'Red-eyed at 2am, layered', portraits: [] }, portrait_url: null,
  update: jest.fn(async function update(patch) { Object.assign(this, patch); }),
  ...extra,
});

let black;
let face;
beforeAll(async () => {
  black = await jpeg({ r: 0, g: 0, b: 0 });
  face = await jpeg({ r: 180, g: 140, b: 120 });
});
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  generateImage.mockReset();
  axios.get.mockReset();
  storePulseImage.mockReset().mockResolvedValue({ url: 'https://store/p.jpg' });
});

test('isBlank: a black image is blank, a real one is not', async () => {
  expect(await isBlank(black)).toBe(true);
  expect(await isBlank(face)).toBe(false);
});

test('a flagged image is retried, and only the good one is kept', async () => {
  generateImage
    .mockResolvedValueOnce({ url: 'https://fal/1.jpg', cost_estimate: 0.04, nsfw_flagged: true })
    .mockResolvedValueOnce({ url: 'https://fal/2.jpg', cost_estimate: 0.04, nsfw_flagged: false });
  axios.get.mockResolvedValue({ data: face });
  const c = character();
  const out = await generatePortrait({}, c);
  expect(generateImage).toHaveBeenCalledTimes(2);
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(axios.get).toHaveBeenCalledWith('https://fal/2.jpg', expect.anything());
  expect(out).toEqual({ url: 'https://store/p.jpg', cost: 0.08 });
  expect(c.appearance.portraits.map((p) => p.url)).toEqual(['https://store/p.jpg']);
});

test('a black image with no flag is caught too; twice black saves nothing and says why', async () => {
  generateImage.mockResolvedValue({ url: 'https://fal/x.jpg', cost_estimate: 0.04, nsfw_flagged: false });
  axios.get.mockResolvedValue({ data: black });
  const c = character();
  const err = await generatePortrait({}, c).catch((e) => e);
  expect(err).toBeInstanceOf(AppearanceError);
  expect(err.status).toBe(422);
  expect(err.message).toMatch(/blocked this portrait twice/);
  expect(generateImage).toHaveBeenCalledTimes(2);
  expect(storePulseImage).not.toHaveBeenCalled();
  expect(c.update).not.toHaveBeenCalled();
});

test('Remove drops a portrait, and clears the profile photo when it was that one', async () => {
  const c = character({ appearance: { summary: 'x', portraits: [{ url: 'a' }, { url: 'b' }] }, portrait_url: 'b' });
  await removePortrait(c, 'b');
  expect(c.appearance.portraits).toEqual([{ url: 'a' }]);
  expect(c.portrait_url).toBeNull();
  await removePortrait(c, 'a');
  expect(c.appearance.portraits).toEqual([]);
  await expect(removePortrait(c, 'nope')).rejects.toMatchObject({ status: 400 });
});
