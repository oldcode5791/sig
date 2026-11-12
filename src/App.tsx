import React, { useState, useMemo, useEffect } from 'react';
import {
  type SignatureData,
  DEFAULT_SIGNATURE,
  type SignatureLayout,
  type AvatarShape,
  compileSignatureHtml,
} from './utils/signatureCompiler';

/**
 * Structure stored in browser localStorage for saved user signature presets.
 */
interface SavedProfile {
  id: string;
  label: string;
  data: SignatureData;
}

// LocalStorage namespace key for persisting saved signature presets on-device
const STORAGE_KEY = 'the_lal_sig_profiles_v1';

// Web-safe system font stacks supported reliably across desktop and mobile email clients
const FONT_OPTIONS = [
  { label: 'Arial (Universal Safe)', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana (High Legibility)', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS (Clean Sans)', value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: 'Georgia (Classic Serif)', value: 'Georgia, Times, serif' },
  { label: 'Courier New (Monospace)', value: "'Courier New', Courier, monospace" },
];

/**
 * Main application component for Subspace Hail & Signature Studio.
 * Provides a zero-upload, client-side split-pane editor and live email client simulator
 * with contextual plain-English tooltips on every field and action for everyday users.
 */
export function App() {
  // Active form state initialized to the Starfleet placeholder preset
  const [data, setData] = useState<SignatureData>(DEFAULT_SIGNATURE);

  // Active editor tab ('details' = Identity, 'branding' = Visuals, 'extras' = Quote & Legal)
  const [activeTab, setActiveTab] = useState<'details' | 'branding' | 'extras'>('details');

  // Simulator viewport controls (light/dark canvas background & blocked-image testing)
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');
  const [simulateBlockedImages, setSimulateBlockedImages] = useState(false);
  const [outputTab, setOutputTab] = useState<'preview' | 'html'>('preview');

  // Transient toast feedback banner message
  const [toast, setToast] = useState<string | null>(null);

  // Hydrate saved presets from localStorage on initial mount
  const [profiles, setProfiles] = useState<SavedProfile[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [profileName, setProfileName] = useState('');

  // Sync saved presets back to localStorage whenever the list changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch {
      // Ignore browser storage quota errors in private/incognito sessions
    }
  }, [profiles]);

  // Displays a temporary floating notification banner for 3.2 seconds
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  // Compile production HTML table (without blocked-image placeholders)
  const compiledHtml = useMemo(() => compileSignatureHtml(data, false), [data]);

  // Compile live preview HTML table (honors the blocked-image simulation toggle)
  const previewHtml = useMemo(
    () => compileSignatureHtml(data, simulateBlockedImages),
    [data, simulateBlockedImages]
  );

  // Calculate exact UTF-8 byte footprint and warn before reaching Gmail's 102 KB message clip threshold
  const htmlByteSize = useMemo(() => new Blob([compiledHtml]).size, [compiledHtml]);
  const gmailClipRisk = htmlByteSize > 90000;

  // Generic state updater for individual SignatureData fields
  const updateField = <K extends keyof SignatureData>(key: K, value: SignatureData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Resizes and compresses a local image file entirely in browser memory using HTML5 Canvas,
   * then encodes it as a base64 Data URI so zero files are ever uploaded to a server.
   */
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'avatarUrl' | 'bannerUrl',
    maxWidth: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale proportionally if the source image exceeds maxWidth
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);

        // Preserve transparency for PNGs; use 86% quality JPEG for photos/banners
        const isPng = file.type === 'image/png';
        const dataUrl = isPng
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.86);

        updateField(target, dataUrl);
        showToast(`Compressed image locally (${Math.round(dataUrl.length / 1024)} KB)`);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);

    // Reset file input so the same file can be re-selected if needed
    e.target.value = '';
  };

  /**
   * Copies both rich HTML (text/html) and plain-text fallback (text/plain) to the system clipboard.
   * Allows direct Ctrl+V pasting into Gmail, Outlook, and Apple Mail signature editors.
   */
  const handleCopyRichText = async () => {
    try {
      const htmlBlob = new Blob([compiledHtml], { type: 'text/html' });
      const textBlob = new Blob(
        [`${data.fullName}\n${data.jobTitle} — ${data.companyName}\n${data.email} | ${data.mobile || data.phone}`],
        { type: 'text/plain' }
      );
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);
      showToast('Copied rendered signature! Paste directly (Ctrl+V) into Gmail, Outlook, or Apple Mail.');
    } catch {
      showToast('Rich clipboard blocked by browser — use "Copy Raw HTML" or select inside preview.');
    }
  };

  /**
   * Copies raw HTML table source code for Exchange/M365 transport rules or HTML-aware mail clients.
   */
  const handleCopyRawHtml = async () => {
    await navigator.clipboard.writeText(compiledHtml);
    showToast('Copied raw table HTML to clipboard.');
  };

  /**
   * Triggers a client-side download of the compiled signature as a standalone .html file.
   */
  const handleDownloadHtml = () => {
    const slug = (data.fullName || 'signature').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const blob = new Blob([compiledHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-signature.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${slug}-signature.html`);
  };

  /**
   * Saves the current form configuration as a named preset inside browser localStorage.
   */
  const handleSaveProfile = () => {
    const label = profileName.trim() || `${data.fullName || 'Untitled'} (${data.companyName || 'Preset'})`;
    const newEntry: SavedProfile = {
      id: crypto.randomUUID(),
      label,
      data: { ...data },
    };
    setProfiles((prev) => [newEntry, ...prev]);
    setProfileName('');
    showToast(`Saved preset "${label}" in browser storage.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Sticky Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm">
              &lt;/&gt;
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Subspace Hail &amp; Signature Studio
                <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Zero Tracking
                  <InfoTooltip text="Everything runs locally in your browser. Your name, phone number, and images are never uploaded to any server." />
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Bulletproof Outlook &amp; Gmail Table Compiler &bull; 100% Client-Side
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <a
              href="https://apps.the-lal.net"
              title="Return to the full the-lal.net browser utility directory"
              className="text-slate-400 hover:text-cyan-400 transition-colors"
            >
              &larr; App Showcase
            </a>
          </div>
        </div>
      </header>

      {/* Floating Toast Status Banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-cyan-500/50 text-cyan-200 px-4 py-3 rounded-xl shadow-2xl text-sm max-w-md">
          {toast}
        </div>
      )}

      {/* Split-Pane Studio Workspace (Left: Controls, Right: Live Preview) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Editor Tabs & Local Presets */}
        <section className="lg:col-span-5 space-y-5">
          {/* Step Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
            {(
              [
                {
                  id: 'details',
                  label: '1. Identity',
                  tip: 'Step 1: Enter your name, job title, company, and contact numbers.',
                },
                {
                  id: 'branding',
                  label: '2. Visuals',
                  tip: 'Step 2: Choose your layout, fonts, brand colours, and logo or photo.',
                },
                {
                  id: 'extras',
                  label: '3. Quote & Legal',
                  tip: 'Step 3: Add a favourite quote, social buttons, banner, or legal disclaimer.',
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.tip}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Contact & Role Details */}
          {activeTab === 'details' && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField
                  label="Full Name"
                  tooltip="Your display name shown at the very top of your email signature in bold."
                  value={data.fullName}
                  onChange={(v) => updateField('fullName', v)}
                  placeholder="Patrick Stewart"
                />
                <InputField
                  label="Job Title"
                  tooltip="Your role or position (e.g., Operations Manager, Director). Leave blank to hide."
                  value={data.jobTitle}
                  onChange={(v) => updateField('jobTitle', v)}
                  placeholder="Commanding Officer"
                />
                <InputField
                  label="Department (Optional)"
                  tooltip="Your team or division name, separated from your title by a clean bullet dot."
                  value={data.department}
                  onChange={(v) => updateField('department', v)}
                  placeholder="USS Enterprise (NCC-1701-D)"
                />
                <InputField
                  label="Company / Organisation"
                  tooltip="Your business or organisation name, highlighted in your chosen Accent colour."
                  value={data.companyName}
                  onChange={(v) => updateField('companyName', v)}
                  placeholder="Starfleet Command"
                />
                <InputField
                  label="Email Address"
                  tooltip="Creates a clickable mailto: link so recipients can email you in one tap."
                  value={data.email}
                  onChange={(v) => updateField('email', v)}
                  placeholder="you@domain.com"
                />
                <InputField
                  label="Website"
                  tooltip="Your website URL. Automatically adds https:// if you omit it."
                  value={data.website}
                  onChange={(v) => updateField('website', v)}
                  placeholder="https://the-lal.net"
                />
                <InputField
                  label="Mobile Phone"
                  tooltip="Creates a tap-to-call link on smartphones. Leave blank to hide the M: row."
                  value={data.mobile}
                  onChange={(v) => updateField('mobile', v)}
                  placeholder="+61 400 000 000"
                />
                <InputField
                  label="Direct / Office Phone"
                  tooltip="Your desk or landline number. Automatically paired beside Mobile if both are filled."
                  value={data.phone}
                  onChange={(v) => updateField('phone', v)}
                  placeholder="07 4700 0000"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <InputField
                    label="Location / Address"
                    tooltip="Your city, state, or street address. Leave blank if you work remotely."
                    value={data.address}
                    onChange={(v) => updateField('address', v)}
                    placeholder="Sector 001, Earth Orbit"
                  />
                </div>
                <InputField
                  label="ABN (Optional)"
                  tooltip="Australian Business Number (or tax ID) displayed neatly below your address."
                  value={data.abn}
                  onChange={(v) => updateField('abn', v)}
                  placeholder="12 345 678 901"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Table Layout, Typography, Colors & Avatar */}
          {activeTab === 'branding' && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="text-xs font-medium text-slate-300">
                    Table Layout Structure
                  </label>
                  <InfoTooltip text="Choose how your photo/logo and text are arranged. All three use classic HTML tables that never break in Outlook." />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'classic-left',
                        label: 'Left Split',
                        tip: 'Places your logo or headshot on the left with a vertical accent divider line.',
                      },
                      {
                        id: 'banner-top',
                        label: 'Stacked Top',
                        tip: 'Places your logo or headshot above your name—ideal for wide horizontal logos.',
                      },
                      {
                        id: 'minimal-compact',
                        label: 'Minimal Text',
                        tip: 'Clean, compact text-only layout without a divider bar or side image column.',
                      },
                    ] as { id: SignatureLayout; label: string; tip: string }[]
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => updateField('layout', item.id)}
                      title={item.tip}
                      className={`py-2 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                        data.layout === item.id
                          ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      Email-Safe Font Stack
                    </label>
                    <InfoTooltip text="Web fonts often fail in Outlook and Gmail. These system fonts are pre-installed on Windows, Mac, iOS, and Android." />
                  </div>
                  <select
                    value={data.fontFamily}
                    onChange={(e) => updateField('fontFamily', e.target.value)}
                    title="Select a universal system font supported by all major email apps"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <ColorField
                    label="Accent"
                    tooltip="Highlight colour used for divider lines, labels (E:, M:, W:), website link, and LinkedIn badge."
                    value={data.accentColor}
                    onChange={(v) => updateField('accentColor', v)}
                  />
                  <ColorField
                    label="Primary"
                    tooltip="Main text colour used for your full name and clickable contact links."
                    value={data.textColor}
                    onChange={(v) => updateField('textColor', v)}
                  />
                  <ColorField
                    label="Muted"
                    tooltip="Secondary grey tone used for job title, address, and quote text."
                    value={data.mutedColor}
                    onChange={(v) => updateField('mutedColor', v)}
                  />
                </div>
              </div>

              {/* Avatar / Logo URL or Client-Side Canvas Compressor */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Logo or Headshot (Hosted URL or Local File)
                    </label>
                    <InfoTooltip text="Paste a public HTTPS image link (smallest file size) or upload a photo from your device to embed it directly." />
                  </div>
                  <label
                    title="Pick a PNG, JPG, or WebP from your device—automatically shrunk to 240px inside your browser"
                    className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium"
                  >
                    + Compress Local Image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'avatarUrl', 240)}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={data.avatarUrl}
                  onChange={(e) => updateField('avatarUrl', e.target.value)}
                  placeholder="https://yourdomain.com/logo.png"
                  title="Direct HTTPS URL to your logo or profile photo (leave blank for text-only)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="text-xs text-slate-400">
                        Width: <span className="text-slate-200 font-mono">{data.avatarWidth}px</span>
                      </label>
                      <InfoTooltip text="Controls the display width of your logo or photo in pixels (48px to 150px)." />
                    </div>
                    <input
                      type="range"
                      min={48}
                      max={150}
                      value={data.avatarWidth}
                      onChange={(e) => updateField('avatarWidth', Number(e.target.value))}
                      title="Drag to resize logo or headshot width"
                      className="w-full accent-cyan-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="text-xs text-slate-400">Corner Shape</label>
                      <InfoTooltip text="Rounds the corners of your image into a square, soft-rounded card, or full circle." />
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(['square', 'rounded', 'circle'] as AvatarShape[]).map((shape) => (
                        <button
                          key={shape}
                          onClick={() => updateField('avatarShape', shape)}
                          title={`Set image corners to ${shape}`}
                          className={`py-1.5 rounded text-[11px] capitalize border cursor-pointer ${
                            data.avatarShape === shape
                              ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          {shape}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Quote Block, Social Badges, Promotional Banner & Legal Disclaimer */}
          {activeTab === 'extras' && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="space-y-3">
                <InputField
                  label="Quote / Motto (Optional)"
                  tooltip="Adds an italic quote or company tagline with a coloured side bar below your contact details."
                  value={data.quoteText ?? ''}
                  onChange={(v) => updateField('quoteText', v)}
                  placeholder="Make it so."
                />
                <InputField
                  label="Quote Attribution (Optional)"
                  tooltip="Optional author or speaker name displayed next to your quote (e.g., Capt. Jean-Luc Picard)."
                  value={data.quoteAuthor ?? ''}
                  onChange={(v) => updateField('quoteAuthor', v)}
                  placeholder="Capt. Jean-Luc Picard"
                />
              </div>

              <div className="border-t border-slate-800 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InputField
                  label="LinkedIn URL"
                  tooltip="Adds a crisp, text-based LinkedIn badge that never breaks when images are blocked."
                  value={data.linkedinUrl}
                  onChange={(v) => updateField('linkedinUrl', v)}
                  placeholder="linkedin.com/in/..."
                />
                <InputField
                  label="GitHub URL"
                  tooltip="Adds a clickable GitHub profile button below your contact info."
                  value={data.githubUrl}
                  onChange={(v) => updateField('githubUrl', v)}
                  placeholder="github.com/..."
                />
                <InputField
                  label="X / Social URL"
                  tooltip="Adds a clickable X / social profile badge."
                  value={data.xUrl}
                  onChange={(v) => updateField('xUrl', v)}
                  placeholder="x.com/..."
                />
              </div>

              <div className="border-t border-slate-800 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Optional Promotional Banner (420px wide)
                    </label>
                    <InfoTooltip text="Optional wide graphic at the bottom of your signature for events, awards, or booking links." />
                  </div>
                  <label
                    title="Upload a banner image from your device—compressed locally in your browser"
                    className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium"
                  >
                    + Upload Banner
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'bannerUrl', 840)}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={data.bannerUrl}
                  onChange={(e) => updateField('bannerUrl', e.target.value)}
                  placeholder="https://yourdomain.com/banner.png"
                  title="Direct HTTPS URL to your banner image"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <InputField
                  label="Banner Click-Through Link"
                  tooltip="Destination webpage opened when a recipient clicks your promotional banner."
                  value={data.bannerLink}
                  onChange={(v) => updateField('bannerLink', v)}
                  placeholder="https://apps.the-lal.net"
                />
              </div>

              <div className="border-t border-slate-800 pt-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Confidentiality / Legal Footer
                  </label>
                  <InfoTooltip text="Small-print confidentiality or environmental notice at the bottom. Clear the text box to omit it." />
                </div>
                <textarea
                  rows={3}
                  value={data.disclaimer}
                  onChange={(e) => updateField('disclaimer', e.target.value)}
                  title="Edit or clear the small-print legal footer text"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Browser LocalStorage Preset Manager */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-300">
                  Local Saved Profiles (Browser Storage)
                </span>
                <InfoTooltip text="Save multiple signatures (e.g. Work, Personal, Side Business) right inside this browser—nothing is sent to the cloud." />
              </div>
              <button
                onClick={() => setData(DEFAULT_SIGNATURE)}
                title="Reset all fields back to the default Starfleet sample signature"
                className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
              >
                Reset Default
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Profile label (e.g. Work, Consultant)..."
                title="Give this signature preset a memorable name before saving"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleSaveProfile}
                title="Save the current signature settings to this browser"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 cursor-pointer"
              >
                Save
              </button>
            </div>

            {profiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs"
                  >
                    <button
                      onClick={() => {
                        setData({ ...DEFAULT_SIGNATURE, ...p.data });
                        showToast(`Loaded "${p.label}"`);
                      }}
                      title={`Load the "${p.label}" signature preset into the editor`}
                      className="text-slate-200 hover:text-cyan-400 cursor-pointer"
                    >
                      {p.label}
                    </button>
                    <button
                      onClick={() => setProfiles((prev) => prev.filter((item) => item.id !== p.id))}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer ml-1"
                      title={`Delete "${p.label}" preset from browser storage`}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Live Email Client Simulator & Export Actions */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          {/* Simulator Mode & Byte Size Toolbar */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setOutputTab('preview')}
                title="Preview exactly how your signature looks inside a real email message"
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  outputTab === 'preview'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Live Email Canvas
              </button>
              <button
                onClick={() => setOutputTab('html')}
                title="Inspect the clean, inline-styled HTML table code generated under the hood"
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  outputTab === 'html'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Compiled Table HTML
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {outputTab === 'preview' && (
                <>
                  <button
                    onClick={() => setPreviewTheme(previewTheme === 'light' ? 'dark' : 'light')}
                    title="Check contrast in both light and dark mode email apps (like Apple Mail and Outlook Dark Mode)"
                    className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 cursor-pointer"
                  >
                    {previewTheme === 'light' ? 'Simulate Dark Mode' : 'Simulate Light Mode'}
                  </button>
                  <button
                    onClick={() => setSimulateBlockedImages((v) => !v)}
                    title="Test how your signature degrades when corporate firewalls or Outlook block external images by default"
                    className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                      simulateBlockedImages
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {simulateBlockedImages ? 'Images: Blocked' : 'Test Blocked Images'}
                  </button>
                </>
              )}
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-md border ${
                  gmailClipRisk
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {(htmlByteSize / 1024).toFixed(1)} KB
                <InfoTooltip text="Total signature code size. Gmail clips emails larger than 102 KB—keep this well below 90 KB." />
              </span>
            </div>
          </div>

          {/* Interactive Email Client Viewport or Raw HTML Inspector */}
          {outputTab === 'preview' ? (
            <div className="rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              {/* Mock Mail Window Title Bar */}
              <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                  <span className="ml-2 font-mono text-[11px] text-slate-400">
                    New Message — {previewTheme === 'light' ? 'Light Client' : 'Dark Mode Client'}
                  </span>
                </div>
                {gmailClipRisk && (
                  <span className="text-rose-400 font-medium">
                    Warning: Large embedded image may trigger Gmail clipping
                  </span>
                )}
              </div>

              {/* Simulated Message Body */}
              <div
                className={`p-6 sm:p-8 transition-colors min-h-[320px] ${
                  previewTheme === 'light'
                    ? 'bg-white text-slate-800'
                    : 'bg-slate-950 text-slate-200'
                }`}
              >
                <div
                  className={`text-xs pb-4 mb-5 border-b space-y-1 ${
                    previewTheme === 'light'
                      ? 'border-slate-200 text-slate-500'
                      : 'border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <span className="font-semibold">To:</span> recipient@example.com
                  </div>
                  <div>
                    <span className="font-semibold">Subject:</span> Project Update &amp; Handover
                  </div>
                </div>

                <p
                  className={`text-sm mb-6 ${
                    previewTheme === 'light' ? 'text-slate-700' : 'text-slate-300'
                  }`}
                >
                  Hi team,
                  <br />
                  <br />
                  Please find the updated details attached. Let me know if you need anything else.
                  <br />
                  <br />
                  Kind regards,
                </p>

                {/* Compiled Signature Table Output */}
                <div
                  className="overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <pre className="text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all max-h-[380px] leading-relaxed">
                {compiledHtml}
              </pre>
            </div>
          )}

          {/* Primary Export Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={handleCopyRichText}
              title="Best for everyday use: copies the visual signature so you can paste (Ctrl+V / Cmd+V) straight into Gmail, Outlook, or Apple Mail"
              className="py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/15 transition-all cursor-pointer"
            >
              Copy Rendered Signature
            </button>
            <button
              onClick={handleCopyRawHtml}
              title="Copies raw HTML table code for IT admins configuring Exchange / Microsoft 365 rules or Thunderbird"
              className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 font-semibold text-sm transition-all cursor-pointer"
            >
              Copy Raw Table HTML
            </button>
            <button
              onClick={handleDownloadHtml}
              title="Saves a standalone .html backup file to your computer"
              className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 font-semibold text-sm transition-all cursor-pointer"
            >
              Download .html File
            </button>
          </div>

          {/* Client Installation Instructions */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 space-y-1.5">
            <p className="font-semibold text-slate-200">Quick Client Setup:</p>
            <p>
              <strong className="text-slate-300">Gmail / Outlook Web / Apple Mail:</strong> Click{' '}
              <span className="text-cyan-400">Copy Rendered Signature</span>, open your mail client&apos;s
              Signature settings box, and press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Ctrl+V</kbd>.
            </p>
            <p>
              <strong className="text-slate-300">Exchange / M365 Transport Rules:</strong> Click{' '}
              <span className="text-cyan-400">Copy Raw Table HTML</span> and paste directly into the
              HTML disclaimer rule action.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * Accessible hover/focus/tap "?" info badge that displays a plain-English tooltip
 * so everyday users immediately understand what each setting does.
 */
function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <button
        type="button"
        aria-label={text}
        className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-cyan-300 hover:border-cyan-500/60 focus:outline-none focus:border-cyan-400 flex items-center justify-center cursor-help leading-none"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-normal normal-case leading-snug text-slate-200 shadow-2xl z-40 text-left"
      >
        {text}
      </span>
    </span>
  );
}

/**
 * Reusable text input field styled for the dark-slate editor panel with an optional tooltip badge.
 */
function InputField({
  label,
  tooltip,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  tooltip?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs font-medium text-slate-300">{label}</label>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        title={tooltip}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
      />
    </div>
  );
}

/**
 * Reusable HTML5 color picker input for accent, primary text, and muted text hex values.
 */
function ColorField({
  label,
  tooltip,
  value,
  onChange,
}: {
  label: string;
  tooltip?: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <label className="text-[11px] font-medium text-slate-300">{label}</label>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={tooltip}
        className="w-full h-8 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer p-0.5"
      />
    </div>
  );
}

export default App;
