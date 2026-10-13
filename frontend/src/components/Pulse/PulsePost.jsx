/**
 * One post on The Pulse as Lala sees it (Task 2927; spec §3 Centre, §8
 * "Comments count"): the author's photo (else their initial), name, time and
 * place (its tagged city or venue, else the poster's city; Task 3090), which
 * opens that city's feed when onCity is given; the words with #tags styled; a photo grid for one to four photos;
 * likes, comments and shares; the first live comment with its author's photo,
 * and "View N more" only when N more live comments exist. Nothing behind the
 * curtain. Before its reveal (Task 2939) a teaser post reads "First look" and
 * its photos are blurred; Director view shows when it reveals.
 * Styles: pages/SocialMediaPage.css (pl-*).
 */
import React, { useState } from 'react';
import { Heart, MessageCircle, Repeat2 } from 'lucide-react';
import { posterOf, whenLabel, initial } from '../../lib/pulsePosts';
import { DREAM_CITIES } from '../../data/dreamCities';
import { FirstLook, RevealChip } from './PulseReveal';
import { placeOfPost } from '../../lib/pulsePlaces';

/** A Dream City's name from its key (social_profiles.city), else null. */
export const cityName = (key) => DREAM_CITIES.find((c) => c.key === key)?.name || null;

export function Avatar({ name, url, size = 40 }) {
  const style = { width: size, height: size };
  return url
    ? <img className="pl-avatar" src={url} alt="" style={style} />
    : <span className="pl-avatar pl-avatar-initial" style={{ ...style, fontSize: Math.round(size * 0.42) }} aria-hidden="true">{initial(name)}</span>;
}

/** The words, with each #tag in its own styled span. */
export function TaggedText({ text }) {
  const parts = String(text || '').split(/(#[\p{L}\p{N}_]+)/u);
  return parts.map((part, i) => (/^#[\p{L}\p{N}_]+$/u.test(part)
    ? <span key={i} className="pl-tag">{part}</span>
    : <React.Fragment key={i}>{part}</React.Fragment>));
}

/** The post's photos: image_urls when a post has several, else its one image_url. */
export const photosOf = (post) => {
  const many = Array.isArray(post.image_urls) ? post.image_urls.filter(Boolean) : [];
  return (many.length ? many : [post.image_url].filter(Boolean)).slice(0, 4);
};

/**
 * The post's photos with their alt text, { src, alt }: its `photos` list
 * (Task 3089, up to four) when it has one, else photosOf with the first
 * photo's description. A first look's photo has no alt text.
 */
export function photoItemsOf(post) {
  const list = Array.isArray(post.photos) ? post.photos.filter((p) => p?.url) : [];
  const items = list.length
    ? list.map((p) => ({ src: p.url, alt: p.alt || '' }))
    : photosOf(post).map((src, i) => ({ src, alt: i === 0 ? (post.image_description || '') : '' }));
  return items.slice(0, 4).map((p) => (post.photo_teaser ? { ...p, alt: '' } : p));
}

/** Several photos swipe one at a time (scroll-snap), with "1 / 3" (Task 3089). */
function PhotoCarousel({ photos }) {
  const [index, setIndex] = useState(0);
  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.clientWidth) setIndex(Math.min(photos.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };
  return (
    <div className="pl-photos pl-carousel" data-testid="pl-photos" role="group" aria-roledescription="carousel" aria-label={`${photos.length} photos`}>
      <div className="pl-carousel-track" onScroll={onScroll} tabIndex={0} aria-label="Swipe for more photos">
        {photos.map((p, i) => (
          <img key={p.src} src={p.src} alt={p.alt} aria-roledescription="slide" aria-label={`${i + 1} of ${photos.length}`} />
        ))}
      </div>
      <p className="pl-carousel-count" data-testid="pl-carousel-count" aria-hidden="true">{index + 1} / {photos.length}</p>
    </div>
  );
}

/**
 * revealLabel: Director view's "Reveals: …" chip for the post (or its photos).
 * onCity(key): opens a Dream City's feed from the post's place.
 */
export default function PulsePost({ post, revealLabel = null, onCity = null }) {
  const [allComments, setAllComments] = useState(false);
  const who = posterOf(post);
  const place = placeOfPost(post);
  // With ?with=comments the list holds the post's live comments; their number
  // is the count (spec §8: the count is the real comments).
  const comments = Array.isArray(post.comments) ? post.comments : null;
  const commentCount = comments ? comments.length : (post.comments_count ?? 0);
  const shown = comments ? (allComments ? comments : comments.slice(0, 1)) : [];
  const more = comments ? comments.length - shown.length : 0;
  const photos = photoItemsOf(post);
  const when = whenLabel(post.posted_at);
  return (
    <article className="pl-post" data-testid="pl-post">
      <header className="pl-post-head">
        <Avatar name={who.name} url={post.author_portrait_url} size={46} />
        <div>
          <p className="pl-post-name">{who.name}</p>
          {(when || place) && (
            <p className="pl-meta">
              {when}{when && place ? ' · ' : ''}
              {place && (onCity && place.key
                ? <button type="button" className="pl-place-link" data-testid="pl-post-place" onClick={() => onCity(place.key)}>{place.label}</button>
                : <span data-testid="pl-post-place">{place.label}</span>)}
            </p>
          )}
          <RevealChip label={revealLabel} />
        </div>
      </header>
      {post.teaser
        ? <p className="pl-post-text pl-first-look-text" data-testid="pl-post-teaser">First look</p>
        : post.content_text && <p className="pl-post-text"><TaggedText text={post.content_text} /></p>}
      {photos.length > 0 && (
        <FirstLook active={Boolean(post.photo_teaser)} style={post.teaser_style}>
          {photos.length > 1 ? <PhotoCarousel photos={photos} /> : (
            <div className="pl-photos pl-photos-1" data-testid="pl-photos">
              <img src={photos[0].src} alt={photos[0].alt} />
            </div>
          )}
        </FirstLook>
      )}
      <p className="pl-post-actions">
        <span><Heart size={16} aria-hidden="true" /> <span className="pl-sr">Likes</span>{post.likes ?? 0}</span>
        <span><MessageCircle size={16} aria-hidden="true" /> <span className="pl-sr">Comments</span>{commentCount}</span>
        <span><Repeat2 size={16} aria-hidden="true" /> <span className="pl-sr">Shares</span>{post.shares ?? 0}</span>
      </p>
      {shown.map((c) => (
        <div key={c.id} className="pl-comment" data-testid="pl-comment">
          <Avatar name={c.display_name || c.handle} url={c.portrait_url} size={32} />
          <p><b>{c.display_name || c.handle}</b> {c.text}</p>
        </div>
      ))}
      {more > 0 && (
        <button type="button" className="pl-more-comments" onClick={() => setAllComments(true)}>
          View {more} more {more === 1 ? 'comment' : 'comments'}
        </button>
      )}
    </article>
  );
}
