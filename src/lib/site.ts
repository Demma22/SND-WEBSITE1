/**
 * Studio contact details, in one place.
 * Previously these were retyped per page (the WhatsApp number lived inline in
 * products.astro, the email in three templates).
 */

/** International format, no "+" — wa.me requires it that way. */
export const WHATSAPP = '256742072661';
export const EMAIL = 'sndstudio.ug@gmail.com';

/** Personal account carries the art and the sketchbook challenge. */
export const INSTAGRAM_ART = 'https://www.instagram.com/ss_demma/';
/** Studio account carries the brand. */
export const INSTAGRAM_STUDIO = 'https://www.instagram.com/snd.studiio/';

export const LOCATION = 'Kampala, Uganda';

/** Prefilled WhatsApp deep link. */
export const whatsappLink = (message: string) =>
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;

/** Prefilled mailto link. */
export const mailtoLink = (subject: string, body?: string) => {
  const params = new URLSearchParams({ subject });
  if (body) params.set('body', body);
  return `mailto:${EMAIL}?${params.toString()}`;
};
