export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
          <Icon size={24} className="text-brand-400" />
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-800 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  )
}
