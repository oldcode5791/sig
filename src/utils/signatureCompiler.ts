/**
 * Supported structural layouts for the rendered email signature table.
 * - 'classic-left': Two-column layout with avatar/logo on the left and a vertical accent divider.
 * - 'banner-top': Stacked layout with avatar/logo positioned above the identity block.
 * - 'minimal-compact': Text-only compact layout without avatar column or accent bar.
 */
export type SignatureLayout = 'classic-left' | 'banner-top' | 'minimal-compact';

/**
 * Corner radius presets applied to the avatar/logo image container.
 */
export type AvatarShape = 'square' | 'rounded' | 'circle';

/**
 * Complete data model representing all configurable fields of an email signature.
 */
export interface SignatureData {
  fullName: string;
  jobTitle: string;
  department: string;
  companyName: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  address: string;
  abn: string;
  taxLabel: string;
  avatarUrl: string;
  avatarWidth: number;
  avatarShape: AvatarShape;
  bannerUrl: string;
  bannerLink: string;
  bannerAlt: string;
  linkedinUrl: string;
  githubUrl: string;
  xUrl: string;
  quoteText: string;
  quoteAuthor: string;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  fontFamily: string;
  layout: SignatureLayout;
  disclaimer: string;
}

/**
 * Default placeholder profile loaded on first visit (Starfleet / Patrick Stewart preset).
 * Ensures zero personal user data is shipped in the public repository or client bundle.
 */
export const DEFAULT_SIGNATURE: SignatureData = {
  fullName: 'Patrick Stewart',
  jobTitle: 'Commanding Officer (Capt. Jean-Luc Picard)',
  department: 'USS Enterprise (NCC-1701-D)',
  companyName: 'United Federation of Planets — Starfleet',
  email: 'j.picard@enterprise.starfleet.ufp',
  phone: 'Subspace Channel 04',
  mobile: '+1 701 1701 1701',
  website: 'https://apps.the-lal.net',
  address: 'Sector 001, Earth Orbit / La Barre, France',
  abn: '',
  taxLabel: 'ABN',
  avatarUrl: '',
  avatarWidth: 84,
  avatarShape: 'rounded',
  bannerUrl: '',
  bannerLink: '',
  bannerAlt: 'Promotional banner',
  linkedinUrl: '',
  githubUrl: '',
  xUrl: '',
  quoteText: 'Things are only impossible until they are not.',
  quoteAuthor: 'Capt. Jean-Luc Picard',
  accentColor: '#0284c7',
  textColor: '#0f172a',
  mutedColor: '#475569',
  fontFamily: 'Arial, Helvetica, sans-serif',
  layout: 'classic-left',
  disclaimer:
    'SUBSPACE TRANSMISSION NOTICE: This communiqué is intended solely for the designated Starfleet or Federation recipient. Unauthorized interception violates Federation Security Directive 47.',
};

/**
 * Shared avatar width bounds so the slider, tooltip and compiler all agree.
 */
export const AVATAR_MIN_WIDTH = 48;
export const AVATAR_MAX_WIDTH = 150;

/**
 * Escapes HTML special characters to prevent XSS injection and malformed markup
 * when compiling user-supplied text into raw HTML table cells. Apostrophes are
 * intentionally left as-is because every attribute emitted below is double-quoted.
 */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Ensures external URLs include an explicit http:// or https:// protocol scheme
 * so email clients render clickable anchors reliably.
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Normalises an image source: inline `data:image/` URIs are passed through
 * untouched, while hosted paths are upgraded to an absolute https:// URL so a
 * scheme-less value cannot resolve to a broken relative path inside an email.
 */
function normalizeImageSrc(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^data:image\//i.test(trimmed)) return trimmed;
  return normalizeUrl(trimmed);
}

/**
 * Strips protocol prefixes and trailing slashes for cleaner visual display text
 * while preserving the full URL in the underlying href attribute.
 */
function displayUrl(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/**
 * Computes pixel border-radius values for avatar images.
 * Uses explicit pixel values rather than percentages for broader email client compatibility.
 */
function getBorderRadius(shape: AvatarShape, width: number): string {
  if (shape === 'circle') return `${Math.round(width / 2)}px`;
  if (shape === 'rounded') return '10px';
  return '0px';
}

/**
 * Compiles a SignatureData object into an email-client-safe nested HTML table string.
 * Uses strictly inline CSS styles, presentation tables, and explicit cell padding
 * to ensure consistent rendering across Outlook (Word engine), Gmail, and Apple Mail.
 *
 * @param data - User-configured signature fields and theme colors
 * @param blockImages - When true, replaces <img> tags with dashed placeholder boxes to preview blocked-image states
 */
export function compileSignatureHtml(data: SignatureData, blockImages = false): string {
  // Sanitize global typography and hex color variables
  const font = esc(data.fontFamily);
  const accent = esc(data.accentColor);
  const text = esc(data.textColor);
  const muted = esc(data.mutedColor);

  // Format primary identity header fields
  const name = esc(data.fullName.trim() || 'Your Name');
  const titleParts = [data.jobTitle.trim(), data.department.trim()]
    .filter(Boolean)
    .map(esc);
  const company = esc(data.companyName.trim());

  // Build individual contact rows dynamically so empty fields leave zero blank table rows
  const contactRows: string[] = [];

  // Email row with mailto: link
  if (data.email.trim()) {
    const email = esc(data.email.trim());
    contactRows.push(
      `<tr><td style="padding:2px 0;font-family:${font};font-size:13px;line-height:18px;color:${muted};"><strong style="color:${accent};font-weight:700;">E:</strong> <a href="mailto:${email}" style="color:${text};text-decoration:none;">${email}</a></td></tr>`
    );
  }

  // Combine Direct/Office Phone and Mobile onto a single compact pipe-delimited row
  const phoneItems: string[] = [];
  const phoneEntry = (label: string, raw: string) => {
    const value = esc(raw.trim());
    const tel = value.replace(/[^+\d]/g, '');
    const prefix = `<strong style="color:${accent};font-weight:700;">${label}:</strong> `;
    // Require a plausible number of digits before making a tap-to-call link, so
    // labels like "Subspace Channel 04" are shown as plain text.
    return tel.replace(/\D/g, '').length >= 7
      ? `${prefix}<a href="tel:${tel}" style="color:${text};text-decoration:none;">${value}</a>`
      : `${prefix}${value}`;
  };
  if (data.phone.trim()) phoneItems.push(phoneEntry('P', data.phone));
  if (data.mobile.trim()) phoneItems.push(phoneEntry('M', data.mobile));
  if (phoneItems.length > 0) {
    contactRows.push(
      `<tr><td style="padding:2px 0;font-family:${font};font-size:13px;line-height:18px;color:${muted};">${phoneItems.join(' &nbsp;|&nbsp; ')}</td></tr>`
    );
  }

  // Website row with normalized external URL
  if (data.website.trim()) {
    const href = esc(normalizeUrl(data.website));
    const label = esc(displayUrl(data.website));
    contactRows.push(
      `<tr><td style="padding:2px 0;font-family:${font};font-size:13px;line-height:18px;color:${muted};"><strong style="color:${accent};font-weight:700;">W:</strong> <a href="${href}" target="_blank" rel="noopener noreferrer" style="color:${accent};text-decoration:none;font-weight:600;">${label}</a></td></tr>`
    );
  }

  // Physical location / postal address row
  if (data.address.trim()) {
    contactRows.push(
      `<tr><td style="padding:2px 0;font-family:${font};font-size:12px;line-height:17px;color:${muted};">${esc(data.address.trim())}</td></tr>`
    );
  }

  // Business/tax identifier row when provided (label is user-editable)
  if (data.abn.trim()) {
    contactRows.push(
      `<tr><td style="padding:2px 0;font-family:${font};font-size:11px;line-height:16px;color:${muted};">${esc(data.taxLabel.trim() || 'ABN')}: ${esc(data.abn.trim())}</td></tr>`
    );
  }

  // Build text-based pill badges for social links (immune to external icon blocking).
  // Rendered as table cells with bgcolor padding because Outlook's Word engine
  // ignores border-radius and padding on inline-block anchors.
  const socialBadges: { href: string; label: string; bg: string }[] = [];
  if (data.linkedinUrl.trim()) {
    socialBadges.push({ href: normalizeUrl(data.linkedinUrl), label: 'LinkedIn', bg: accent });
  }
  if (data.githubUrl.trim()) {
    socialBadges.push({ href: normalizeUrl(data.githubUrl), label: 'GitHub', bg: '#1e293b' });
  }
  if (data.xUrl.trim()) {
    socialBadges.push({ href: normalizeUrl(data.xUrl), label: 'X', bg: '#0f172a' });
  }

  const socialHtml =
    socialBadges.length > 0
      ? `<tr><td style="padding-top:8px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;"><tr>${socialBadges
          .map(
            (b) =>
              `<td bgcolor="${b.bg}" style="background-color:${b.bg};padding:3px 8px;font-family:${font};font-size:11px;font-weight:700;line-height:14px;"><a href="${esc(
                b.href
              )}" target="_blank" rel="noopener noreferrer" style="color:#ffffff;text-decoration:none;font-family:${font};font-size:11px;font-weight:700;">${
                b.label
              }</a></td>`
          )
          .join('<td width="6" style="font-size:1px;line-height:1px;">&nbsp;</td>')}</tr></table></td></tr>`
      : '';

  // Clamp avatar width within the shared safe bounds and render either the real
  // <img> or a dashed wireframe when simulating blocked images.
  const hasAvatar = Boolean(data.avatarUrl.trim());
  const avatarW = Math.max(AVATAR_MIN_WIDTH, Math.min(AVATAR_MAX_WIDTH, data.avatarWidth || 84));
  const radius = getBorderRadius(data.avatarShape, avatarW);
  const avatarHeightAttr = data.avatarShape === 'circle' ? ` height="${avatarW}"` : '';

  const avatarImgHtml = hasAvatar
    ? blockImages
      ? `<div style="width:${avatarW}px;height:${avatarW}px;border:1px dashed #94a3b8;border-radius:${radius};font-family:${font};font-size:10px;color:#64748b;text-align:center;line-height:${avatarW}px;overflow:hidden;">[Image: ${esc(data.companyName || data.fullName)}]</div>`
      : `<img src="${esc(normalizeImageSrc(data.avatarUrl))}" alt="${esc(data.fullName || 'Logo')}" width="${avatarW}"${avatarHeightAttr} style="display:block;width:${avatarW}px;max-width:${avatarW}px;height:auto;border:0;border-radius:${radius};" />`
    : '';

  // Assemble the inner identity & contact sub-table
  const identityBlock = `
    <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
      <tr>
        <td style="font-family:${font};font-size:18px;font-weight:700;line-height:22px;color:${text};padding-bottom:2px;">
          ${name}
        </td>
      </tr>
      ${
        titleParts.length > 0 || company
          ? `<tr>
              <td style="font-family:${font};font-size:13px;line-height:18px;color:${muted};padding-bottom:8px;">
                ${titleParts.join(' &bull; ')}${titleParts.length > 0 && company ? ' &mdash; ' : ''}${company ? `<strong style="color:${accent};font-weight:700;">${company}</strong>` : ''}
              </td>
            </tr>`
          : ''
      }
      ${
        data.layout === 'minimal-compact'
          ? ''
          : `<tr><td style="padding-bottom:8px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="44" style="border-collapse:collapse;"><tr><td height="3" style="background-color:${accent};font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>`
      }
      ${contactRows.join('')}
      ${socialHtml}
    </table>
  `;

  // Arrange outer table cells according to the selected layout template
  let mainBody = '';

  if (data.layout === 'classic-left' && hasAvatar) {
    mainBody = `
      <tr>
        <td valign="top" style="padding-right:16px;border-right:2px solid ${accent};">
          ${avatarImgHtml}
        </td>
        <td valign="top" style="padding-left:16px;">
          ${identityBlock}
        </td>
      </tr>
    `;
  } else if (data.layout === 'banner-top' && hasAvatar) {
    mainBody = `
      <tr>
        <td valign="top" style="padding-bottom:12px;">
          ${avatarImgHtml}
        </td>
      </tr>
      <tr>
        <td valign="top">
          ${identityBlock}
        </td>
      </tr>
    `;
  } else {
    mainBody = `
      <tr>
        <td valign="top">
          ${identityBlock}
        </td>
      </tr>
    `;
  }

  // Optional accented blockquote row with attribution
  const quoteHtml = (data.quoteText ?? '').trim()
    ? `<tr><td colspan="2" style="padding-top:12px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;max-width:520px;"><tr><td style="border-left:3px solid ${accent};padding:2px 0 2px 10px;font-family:${font};font-size:12px;font-style:italic;line-height:17px;color:${muted};">&ldquo;${esc(data.quoteText.trim())}&rdquo;${(data.quoteAuthor ?? '').trim() ? ` <span style="font-style:normal;font-weight:600;color:${text};">&mdash; ${esc(data.quoteAuthor.trim())}</span>` : ''}</td></tr></table></td></tr>`
    : '';

  // Optional promotional banner row (420px standard email width) with optional anchor wrapper
  const bannerHtml =
    data.bannerUrl.trim()
      ? (() => {
          const img = blockImages
            ? `<div style="width:420px;max-width:100%;height:70px;border:1px dashed #94a3b8;font-family:${font};font-size:11px;color:#64748b;text-align:center;line-height:70px;">[Promotional Banner Blocked]</div>`
            : `<img src="${esc(normalizeImageSrc(data.bannerUrl))}" alt="${esc(data.bannerAlt.trim() || 'Banner')}" width="420" style="display:block;width:420px;max-width:100%;height:auto;border:0;border-radius:6px;" />`;
          const wrapped = data.bannerLink.trim()
            ? `<a href="${esc(normalizeUrl(data.bannerLink))}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">${img}</a>`
            : img;
          return `<tr><td colspan="2" style="padding-top:14px;">${wrapped}</td></tr>`;
        })()
      : '';

  // Optional confidentiality / legal disclaimer footer separated by a subtle top border
  const disclaimerHtml = data.disclaimer.trim()
    ? `<tr><td colspan="2" style="padding-top:12px;border-top:1px solid #e2e8f0;font-family:${font};font-size:10px;line-height:14px;color:#64748b;max-width:540px;">${esc(data.disclaimer.trim())}</td></tr>`
    : '';

  // Return complete self-contained HTML table markup
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:${font};max-width:560px;">
  ${mainBody}
  ${quoteHtml}
  ${bannerHtml}
  ${disclaimerHtml}
</table>`.trim();
}

/**
 * Wraps the compiled table fragment in a complete, standalone HTML document with
 * an explicit charset, so downloaded or pasted files render non-ASCII characters
 * (such as em dashes) correctly instead of showing mojibake.
 */
export function wrapSignatureDocument(innerHtml: string, title = 'Email Signature'): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:16px;">
${innerHtml}
</body>
</html>`;
}
