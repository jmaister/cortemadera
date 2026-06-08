import React from 'react'

type Props = {
  id?: string
  label?: string
  value: number
  step?: number | string
  min?: number
  onChange: (v: number) => void
}

export default function InputNumber({ id, label, value, step = 1, min, onChange }: Props) {
  return (
    <label>
      {label && <span style={{marginRight:8}}>{label}</span>}
      <input id={id} type="number" value={value} step={step} min={min} onChange={(e)=>onChange(Number(e.target.value||0))} />
    </label>
  )
}
