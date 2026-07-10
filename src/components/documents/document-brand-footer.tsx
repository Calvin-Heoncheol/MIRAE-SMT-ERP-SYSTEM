const MIRAE_LOGO_SRC = '/branding/mirae-logo.png'

export function DocumentBrandFooter() {
  return (
    <div className="document-brand-footer">
      <div className="document-brand-logo-frame">
        <img src={MIRAE_LOGO_SRC} alt="미래 SMT" className="document-brand-logo" />
      </div>
    </div>
  )
}
