/**
 * services/familyTies: the direction rule (family_role reads "A is B's
 * <role>", the reverse is written too) and the readers built on it.
 */
const {
  reverseRole, generationStep, kindOf, genderOf, genderOfRole, familyRoleFor, isSpouseRole, familyWords, familyLines,
} = require('../../../src/services/familyTies');
const { familyBlock } = require('../../../src/services/episodeScriptWriterService');
const { familyNameFor } = require('../../../src/routes/families');

describe('reverseRole', () => {
  it.each([
    ['mother', 'f', 'daughter'], ['mother', 'm', 'son'], ['mother', null, 'child'],
    ['father', null, 'child'], ['daughter', 'f', 'mother'], ['son', null, 'parent'],
    ['sister', 'f', 'sister'], ['sister', 'm', 'brother'], ['brother', null, 'sibling'],
    ['aunt', 'f', 'niece'], ['aunt', 'm', 'nephew'], ['uncle', null, 'niece or nephew'],
    ['niece', 'f', 'aunt'], ['nephew', null, 'aunt or uncle'],
    ['cousin', 'f', 'cousin'], ['cousin', null, 'cousin'],
    ['chosen family', null, 'chosen family'], ['Chosen Family', 'm', 'chosen family'],
    ['grandmother', 'm', 'grandson'], ['granddaughter', null, 'grandparent'],
    ['stepmother', 'f', 'stepdaughter'], ['step-father', 'm', 'stepson'],
    ['half-sister', null, 'half-sibling'], ['great-aunt', 'f', 'great-niece'],
    ['sister-in-law', 'm', 'brother-in-law'], ['mother-in-law', 'f', 'daughter-in-law'],
    ['adoptive mother', 'f', 'adopted daughter'], ['godmother', 'm', 'godson'],
    ['chosen sister', null, 'chosen sibling'],
  ])('%s with a %s other reads back as %s', (role, gender, out) => {
    expect(reverseRole(role, gender)).toBe(out);
  });

  it('knows nothing of a role it cannot read', () => {
    expect(reverseRole('mentor')).toBeNull();
    expect(reverseRole('')).toBeNull();
  });
});

describe('generations, kinds, genders', () => {
  it('places the role above or below', () => {
    expect(generationStep('mother')).toBe(-1);
    expect(generationStep('grandfather')).toBe(-2);
    expect(generationStep('great-grandmother')).toBe(-3);
    expect(generationStep('son')).toBe(1);
    expect(generationStep('sister')).toBe(0);
    expect(generationStep('stepdaughter')).toBe(1);
    expect(generationStep('mentor')).toBeNull();
  });

  it('reads the kind a role implies', () => {
    expect(kindOf('stepmother')).toBe('step');
    expect(kindOf('adopted son')).toBe('adoptive');
    expect(kindOf('chosen family')).toBe('chosen');
    expect(kindOf('sister-in-law')).toBe('married');
    expect(kindOf('aunt')).toBe('blood');
  });

  it('reads gender from gender or pronouns, and from a role', () => {
    expect(genderOf({ gender: 'Female' })).toBe('f');
    expect(genderOf({ pronouns: 'she/her' })).toBe('f');
    expect(genderOf({ gender: 'man' })).toBe('m');
    expect(genderOf({ pronouns: 'he/him' })).toBe('m');
    expect(genderOf({ pronouns: 'they/them' })).toBeNull();
    expect(genderOf(null)).toBeNull();
    expect(genderOfRole('aunt')).toBe('f');
    expect(genderOfRole('stepson')).toBe('m');
    expect(genderOfRole('cousin')).toBeNull();
  });

  it('keeps partners out of family ties', () => {
    expect(isSpouseRole('Wife')).toBe(true);
    expect(isSpouseRole('sister')).toBe(false);
  });
});

describe('familyRoleFor', () => {
  const row = { character_id_a: 'jade', character_id_b: 'dre', family_role: 'sister', reverse_family_role: 'brother' };
  it('reads both directions from one row', () => {
    expect(familyRoleFor(row, 'jade')).toBe('sister');
    expect(familyRoleFor(row, 'dre')).toBe('brother');
    expect(familyRoleFor(row, 'someone')).toBeNull();
  });
  it('works the reverse out on a row written before it was stored', () => {
    expect(familyRoleFor({ ...row, reverse_family_role: null }, 'dre')).toBe('sibling');
    expect(familyRoleFor({ ...row, reverse_family_role: null, b_gender: 'male' }, 'dre')).toBe('brother');
  });
  it('says the tie in words', () => {
    expect(familyWords({ a_name: 'Jade Monroe', b_name: 'Dre Coleman', family_role: 'sister' })).toBe("Jade Monroe is Dre Coleman's sister.");
  });
});

describe('the writers', () => {
  const sequelize = (rows) => ({ query: jest.fn().mockResolvedValue(rows), QueryTypes: { SELECT: 'SELECT' } });

  it('familyLines writes "Jade Monroe: Dre Coleman\'s sister (blood; healing)"', async () => {
    const db = sequelize([{
      character_id_a: 'jade', character_id_b: 'dre', family_role: 'sister', reverse_family_role: 'brother',
      family_kind: 'blood', tension_state: 'healing', a_name: 'Jade Monroe', b_name: 'Dre Coleman',
    }]);
    expect(await familyLines(db, ['jade'])).toEqual(["Jade Monroe: Dre Coleman's sister (blood; healing)"]);
    // From Dre's side when only he is in the list.
    expect(await familyLines(db, ['dre'])).toEqual(["Dre Coleman: Jade Monroe's brother (blood; healing)"]);
  });

  it('familyLines reads nothing for no one, and keeps JustAWoman\'s world out when asked', async () => {
    const db = sequelize([]);
    expect(await familyLines(db, [null, undefined])).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
    await familyLines(db, ['jade'], { lalaverseOnly: true });
    expect(db.query.mock.calls[0][0]).toMatch(/'book-1'/);
    expect(db.query.mock.calls[0][0]).toMatch(/justawoman/);
    await familyLines(db, ['jade']);
    expect(db.query.mock.calls[1][0]).not.toMatch(/'book-1'/);
  });

  it('the script writer appends them under the cast', () => {
    expect(familyBlock([])).toBe('');
    expect(familyBlock(["Jade Monroe: Dre Coleman's sister (blood)"])).toBe("\n\nTHEIR FAMILY (stay consistent with it):\n- Jade Monroe: Dre Coleman's sister (blood)");
  });
});

describe('familyNameFor', () => {
  it('names a family from a surname', () => {
    expect(familyNameFor('Dre Coleman')).toBe('The Colemans');
    expect(familyNameFor('Jade Monroe')).toBe('The Monroes');
    expect(familyNameFor('Sam Ross')).toBe('The Rosses');
    expect(familyNameFor('Lala')).toBe("Lala's family");
  });
});
