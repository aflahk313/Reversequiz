type PageHeaderProps = { eyebrow: string; title: string; description: string }

export default function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return <div className="page-header"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>
}
