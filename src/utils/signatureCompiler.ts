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
  avatarUrl: string;
  avatarWidth: number;
  avatarShape: AvatarShape;
  bannerUrl: string;
  bannerLink: string;
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
  avatarUrl: '',
  avatarWidth: 84,
  avatarShape: 'rounded',
  bannerUrl: '',
  bannerLink: '',
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
 * Escapes HTML special characters to prevent XSS injection and malformed markup
 * when compiling user-supplied text into raw HTML table cells.
 */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  if (data.phone.trim()) {
    const p = esc(data.phone.trim());
    const tel = p.replace(/[^+\d]/g, '');
    phoneItems.push(
      `<strong style="color:${accent};font-weight:700;">P:</strong> <a href="tel:${tel}" style="color:${text};text-decoration:none;">${p}</a>`
    );
  }
  if (data.mobile.trim()) {
    const m = esc(data.mobile.trim());
    const tel = m.replace(/[^+\d]/g, '');
    phoneItems.push(
      `<strong style="color:${accent};font-weight:700;">M:</strong> <a href="tel:${tel}" style="color:${text};text-decoration:none;">${m}</a>`
    );
  }
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

  // Australian Business Number (ABN) row when provided
  if (data.abn.trim()) {
    contactRows.push(
      `<tr><td style="padding:2px 0;font-family:${font};font-size:11px;line-height:16px;color:${muted};">ABN: ${esc(data.abn.trim())}</td></tr>`
    );
  }

  // Build text-based pill badges for social links (immune to external icon blocking)
  const socialLinks: string[] = [];
  if (data.linkedinUrl.trim()) {
    socialLinks.push(
      `<a href="${esc(normalizeUrl(data.linkedinUrl))}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:3px 8px;background-color:${accent};color:#ffffff;font-family:${font};font-size:11px;font-weight:700;text-decoration:none;border-radius:4px;">LinkedIn</a>`
    );
  }
  if (data.githubUrl.trim()) {
    socialLinks.push(
      `<a href="${esc(normalizeUrl(data.githubUrl))}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:3px 8px;background-color:#1e293b;color:#ffffff;font-family:${font};font-size:11px;font-weight:700;text-decoration:none;border-radius:4px;">GitHub</a>`
    );
  }
  if (data.xUrl.trim()) {
    socialLinks.push(
      `<a href="${esc(normalizeUrl(data.xUrl))}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:3px 8px;background-color:#0f172a;color:#ffffff;font-family:${font};font-size:11px;font-weight:700;text-decoration:none;border-radius:4px;">X</a>`
    );
  }

  const socialHtml =
    socialLinks.length > 0
      ? `<tr><td style="padding-top:8px;">${socialLinks.join('&nbsp;')}</td></tr>`
      : '';

  // Clamp avatar width within safe bounds and render either real <img> or blocked-image wireframe
  const hasAvatar = Boolean(data.avatarUrl.trim());
  const avatarW = Math.max(48, Math.min(160, data.avatarWidth || 84));
  const radius = getBorderRadius(data.avatarShape, avatarW);

  const avatarImgHtml = hasAvatar
    ? blockImages
      ? `<div style="width:${avatarW}px;height:${avatarW}px;border:1px dashed #94a3b8;border-radius:${radius};font-family:${font};font-size:10px;color:#64748b;text-align:center;line-height:${avatarW}px;overflow:hidden;">[Image: ${esc(data.companyName || data.fullName)}]</div>`
      : `<img src="${esc(data.avatarUrl.trim())}" alt="${esc(data.fullName || 'Logo')}" width="${avatarW}" style="display:block;width:${avatarW}px;max-width:${avatarW}px;height:auto;border:0;border-radius:${radius};" />`
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
            : `<img src="${esc(data.bannerUrl.trim())}" alt="Banner" width="420" style="display:block;width:420px;max-width:100%;height:auto;border:0;border-radius:6px;" />`;
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
