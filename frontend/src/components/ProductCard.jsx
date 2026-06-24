import { useState } from 'react'
import api from '../api'

const TIERS = {
  'ELITE FUEL':        { color: '#4f9e6a', label: 'Elite' },
  'SOLID CHOICE':      { color: '#5d83bd', label: 'Solid' },
  'BUDGET COMPROMISE': { color: '#bb9043', label: 'Budget' },
  'USE SPARINGLY':     { color: '#c2724a', label: 'Sparingly' },
  'PROCESSED TRAP':    { color: '#c25c5c', label: 'Trap' },
}

export default function ProductCard({ result, onSave }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const tier = TIERS[result.tier] || { color: '#aaa4cf', label: result.tier }

  const name = result.product_name.length > 55
    ? result.product_name.slice(0, 55) + '…'
    : result.product_name

  const cal = result.calories_per_100g || 0
  const prot = result.protein_per_100g || 0
  const ratio = cal > 0 ? prot / cal : 0
  const barPct = Math.min(100, Math.max(6, (ratio / 0.20) * 100))
  const barColor = ratio >= 0.10 ? '#4f9e6a' : ratio >= 0.066 ? '#bb9043' : '#c25c5c'
  const densityLabel = `${(ratio * 100).toFixed(1)}g protein / 100 cal`

  const viewUrl = result.url ||
    `https://www.google.com/search?q=${encodeURIComponent(`${result.product_name} ${result.store_name}`)}`

  async function handleSave() {
    setSaving(true)
    try {
      await api.post('/list/items', {
        product_name: result.product_name,
        store_name: result.store_name,
        price: result.price_per_unit,
        score: result.score,
        tier: result.tier,
        url: result.url || null,
      })
      setSaved(true)
      onSave?.()
    } catch (err) {
      console.error('Save failed', err)
    } finally {
      setSaving(false)
    }
  }

  const macros = [
    { label: 'CALORIES',  value: cal.toFixed(0),                    protein: false },
    { label: 'PROTEIN',   value: `${prot.toFixed(1)}g`,             protein: true  },
    { label: 'SODIUM',    value: `${(result.sodium_per_100g || 0).toFixed(0)}mg`,    protein: false },
    { label: 'POTASSIUM', value: `${(result.potassium_per_100g || 0).toFixed(0)}mg`, protein: false },
  ]

  return (
    <div
      className="bg-white border rounded-2xl p-[18px] flex flex-col gap-[14px]"
      style={{ borderColor: '#e1d5fb', boxShadow: '0 1px 3px rgba(42,35,86,0.07)' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-[14px]">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span
            className="self-start text-white text-[9px] font-extrabold tracking-[0.02em] px-2 py-1 rounded-[7px]"
            style={{ backgroundColor: tier.color }}
          >
            {tier.label}
          </span>
          <p className="text-[15px] font-semibold leading-[1.3] mt-0.5" style={{ color: '#2a2356' }}>
            {name}
          </p>
          <p className="text-[12.5px]" style={{ color: '#8a86b8' }}>
            {result.store_name} · {result.unit}
          </p>
          <p className="text-[12.5px]">
            <span className="font-semibold" style={{ color: '#524d8a' }}>
              ${result.price_per_unit?.toFixed(2)} / {result.unit}
            </span>
            {result.price_per_protein_gram > 0 && (
              <span style={{ color: '#8a86b8' }}>
                {' '}· ${result.price_per_protein_gram.toFixed(4)}/g protein
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span
            className="text-[30px] font-extrabold leading-none"
            style={{ color: tier.color }}
          >
            {typeof result.score === 'number' ? result.score.toFixed(2) : result.score}
          </span>
          <span className="text-[10px] tracking-[0.04em] uppercase" style={{ color: '#aaa4cf' }}>
            VALUE
          </span>
        </div>
      </div>

      {/* Macro strip */}
      <div>
        <div
          className="grid grid-cols-4 rounded-[12px] overflow-hidden border"
          style={{ backgroundColor: '#f5f1ff', borderColor: '#ece4ff' }}
        >
          {macros.map((cell, i) => (
            <div
              key={cell.label}
              className={`flex flex-col items-center py-[11px] px-[6px] text-center ${i < macros.length - 1 ? 'border-r' : ''}`}
              style={{
                borderColor: '#ece4ff',
                backgroundColor: cell.protein ? 'rgba(79,158,106,0.08)' : undefined,
              }}
            >
              <span
                className="text-[16px] leading-none"
                style={{
                  color: cell.protein ? '#2a2356' : '#524d8a',
                  fontWeight: cell.protein ? 800 : 700,
                }}
              >
                {cell.value}
              </span>
              <span
                className="text-[9.5px] font-semibold uppercase tracking-wide mt-1"
                style={{ color: '#aaa4cf' }}
              >
                {cell.label}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-right mt-1" style={{ color: '#aaa4cf' }}>per 100g</p>
      </div>

      {/* Protein density bar */}
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#ece4ff' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${barPct}%`, backgroundColor: barColor }}
          />
        </div>
        <span className="text-[11.5px] font-bold whitespace-nowrap" style={{ color: barColor }}>
          {densityLabel}
        </span>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saved || saving}
          className="text-[12.5px] font-semibold px-[14px] py-2 rounded-[10px] transition-colors"
          style={saved
            ? { backgroundColor: 'rgba(117,123,200,0.18)', color: '#4f51a8' }
            : { backgroundColor: '#ece4ff', color: '#2a2356' }
          }
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : '+ Save'}
        </button>
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-[5px] text-[12.5px] font-bold px-[14px] py-2 rounded-[10px] no-underline transition-colors hover:opacity-90"
          style={{ backgroundColor: '#4f51a8', color: '#f1ebff' }}
        >
          View at {result.store_name}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 10L10 2M5 2h5v5" />
          </svg>
        </a>
      </div>
    </div>
  )
}
