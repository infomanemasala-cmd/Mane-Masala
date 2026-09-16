'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'

type Row = Record<string, any>

type Line = { ingredient_item_id: string; quantity: string; unit_id: string; sequence_number: number; notes: string }

const db = () => createClient()
const txt = (v: any) => String(v ?? '')
const num = (v: any) => Number(v ?? 0)

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function Status({ message, error }: { message: string; error: boolean }) {
  return message ? <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p> : null
}

function blankLine(sequence_number: number): Line {
  return { ingredient_item_id: '', quantity: '', unit_id: '', sequence_number, notes: '' }
}

export default function RecipeManager() {
  const [items, setItems] = useState<Row[]>([])
  const [units, setUnits] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [recipeId, setRecipeId] = useState('')
  const [recipeCode, setRecipeCode] = useState('')
  const [name, setName] = useState('')
  const [outputItemId, setOutputItemId] = useState('')
  const [expectedOutput, setExpectedOutput] = useState('')
  const [outputUnitId, setOutputUnitId] = useState('')
  const [baseIngredientId, setBaseIngredientId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([blankLine(1)])
  const [versions, setVersions] = useState<Row[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadMasters = async () => {
    const [{ data: itemRows }, { data: unitRows }] = await Promise.all([
      db().from('items').select('*').eq('is_active', true).order('name'),
      db().from('units').select('id,name,symbol').eq('is_active', true).order('name'),
    ])
    setItems(itemRows ?? [])
    setUnits(unitRows ?? [])
  }

  useEffect(() => { void loadMasters() }, [])

  const ingredientItems = items.filter(item => item.can_be_used_in_production !== false)
  const unitForItem = (id: string) => txt(items.find(item => txt(item.id) === id)?.base_unit_id)
  const unitLabel = (id: string) => { const u = units.find(x => txt(x.id) === id); return u ? `${txt(u.name)} (${txt(u.symbol)})` : '' }

  const reset = () => {
    setOpen(false); setRecipeId(''); setRecipeCode(''); setName(''); setOutputItemId(''); setExpectedOutput(''); setOutputUnitId(''); setBaseIngredientId(''); setNotes(''); setLines([blankLine(1)]); setVersions([]); setMessage(''); setError(false)
  }

  const startNew = () => {
    setRecipeId(''); setRecipeCode(''); setName(''); setOutputItemId(''); setExpectedOutput(''); setOutputUnitId(''); setBaseIngredientId(''); setNotes(''); setLines([blankLine(1)]); setVersions([]); setMessage(''); setError(false); setOpen(true)
  }

  const openRecipe = async (row: Row) => {
    setOpen(true); setMessage(''); setError(false); setRecipeId(txt(row.id)); setRecipeCode(txt(row.business_code)); setName(txt(row.name)); setOutputItemId(txt(row.output_item_id)); setExpectedOutput(txt(row.expected_output_quantity)); setOutputUnitId(txt(row.output_unit_id)); setBaseIngredientId(txt(row.base_ingredient_item_id)); setNotes('')
    const [{ data: versionRows, error: ve }] = await Promise.all([
      db().from('recipe_versions').select('*').eq('recipe_id', row.id).order('version_number', { ascending: false }),
    ])
    if (ve) { setError(true); setMessage(ve.message); return }
    setVersions(versionRows ?? [])
    const active = (versionRows ?? []).find(v => txt(v.status) === 'active') ?? versionRows?.[0]
    if (!active) { setLines([blankLine(1)]); return }
    setRecipeCode(txt(row.business_code)); setExpectedOutput(txt(active.expected_output_quantity)); setOutputUnitId(txt(active.output_unit_id)); setBaseIngredientId(txt(active.base_ingredient_item_id)); setNotes(txt(active.notes))
    const { data: lineRows, error: le } = await db().from('recipe_lines').select('*').eq('recipe_version_id', active.id).order('sequence_number')
    if (le) { setError(true); setMessage(le.message); return }
    setLines((lineRows ?? []).map((line, index) => ({ ingredient_item_id: txt(line.ingredient_item_id), quantity: txt(line.quantity), unit_id: txt(line.unit_id), sequence_number: num(line.sequence_number) || index + 1, notes: txt(line.notes) })))
  }

  const updateLine = (index: number, patch: Partial<Line>) => setLines(current => current.map((line, i) => i === index ? { ...line, ...patch } : line))

  const chooseIngredient = (index: number, ingredientId: string) => updateLine(index, { ingredient_item_id: ingredientId, unit_id: unitForItem(ingredientId) })

  const addLine = () => setLines(current => [...current, blankLine(current.length + 1)])
  const removeLine = (index: number) => setLines(current => current.length === 1 ? current : current.filter((_, i) => i !== index).map((line, i) => ({ ...line, sequence_number: i + 1 })))

  const save = async (activate: boolean) => {
    setMessage(''); setError(false)
    const clean = lines.filter(line => line.ingredient_item_id && num(line.quantity) > 0).map((line, index) => ({ ...line, quantity: num(line.quantity), sequence_number: index + 1 }))
    if (!name.trim()) { setError(true); setMessage('Recipe name is required.'); return }
    if (!outputItemId || !outputUnitId || num(expectedOutput) <= 0) { setError(true); setMessage('Choose the output item and unit, then enter the expected finished output.'); return }
    if (!clean.length) { setError(true); setMessage('Add at least one raw material.'); return }
    if (!baseIngredientId || !clean.some(line => line.ingredient_item_id === baseIngredientId)) { setError(true); setMessage('Choose one base raw material from the recipe lines.'); return }
    if (clean.some(line => line.unit_id !== unitForItem(line.ingredient_item_id))) { setError(true); setMessage('Each raw material must use its standard base unit.'); return }
    setSaving(true)
    const { data, error: e } = await db().rpc('save_recipe_version', {
      p_recipe_id: recipeId || null,
      p_name: name.trim(),
      p_output_item_id: outputItemId,
      p_base_ingredient_item_id: baseIngredientId,
      p_expected_output_quantity: num(expectedOutput),
      p_output_unit_id: outputUnitId,
      p_lines: clean,
      p_notes: notes.trim() || null,
      p_activate: activate,
      p_effective_from: new Date().toISOString().slice(0, 10),
    })
    setSaving(false)
    if (e) { setError(true); setMessage(e.message); return }
    setRecipeId(txt(data?.recipe_id)); setMessage(activate ? 'Recipe version saved and activated.' : 'Recipe version saved as draft.')
    const { data: refreshed } = await db().from('recipe_versions').select('*').eq('recipe_id', data?.recipe_id).order('version_number', { ascending: false })
    setVersions(refreshed ?? [])
  }

  return <div>
    <div className="master-header"><div><h2>Recipes</h2><p>Maintain one controlled recipe per finished product, with version history and one base raw material as the scaling reference.</p></div><button className="primary-button" type="button" onClick={startNew}>+ Create Recipe</button></div>
    <Panel title="Recipe master"><DataTable table="v_recipes_list" linkColumns={['business_code']} onRowOpen={openRecipe}/></Panel>

    {open && <div className="modal-backdrop"><div className="modal-card purchase-modal">
      <div className="modal-header"><div><h3>{recipeId ? `Recipe ${recipeCode}` : 'Create Recipe'}</h3><p className="muted">Recipe versioning preserves old production history. Changing an active recipe creates a new version.</p></div><button className="secondary-button" type="button" onClick={reset}>Close</button></div>
      <div className="form-grid">
        <Field label="Recipe name"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Vangi Bath Powder — Standard Recipe" /></Field>
        <Field label="Finished / output item"><select value={outputItemId} onChange={e => setOutputItemId(e.target.value)}><option value="">Select finished item</option>{items.map(item => <option key={txt(item.id)} value={txt(item.id)}>{txt(item.item_code || item.business_code)} — {txt(item.name)}</option>)}</select></Field>
        <Field label="Expected finished output"><input type="number" min="0.001" step="0.001" value={expectedOutput} onChange={e => setExpectedOutput(e.target.value)} placeholder="0.000 — finished output quantity" /></Field>
        <Field label="Output unit"><select value={outputUnitId} onChange={e => setOutputUnitId(e.target.value)}><option value="">Select output unit</option>{units.map(unit => <option key={txt(unit.id)} value={txt(unit.id)}>{txt(unit.name)} ({txt(unit.symbol)})</option>)}</select></Field>
        <Field label="Base raw material"><select value={baseIngredientId} onChange={e => setBaseIngredientId(e.target.value)}><option value="">Select base raw material</option>{lines.filter(line => line.ingredient_item_id).map(line => { const item = items.find(x => txt(x.id) === line.ingredient_item_id); return <option key={line.ingredient_item_id} value={line.ingredient_item_id}>{txt(item?.item_code || item?.business_code)} — {txt(item?.name)} · {line.quantity} {unitLabel(line.unit_id)}</option> })}</select></Field>
        <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Recipe notes / process notes" /></Field>
      </div>
      <div className="section-divider" />
      <div className="panel-heading"><h4>Raw material standard</h4><span>Use the item's standard base unit. Total raw-material weight does not define finished output.</span></div>
      <div className="table-wrap"><table><thead><tr><th>SL NO</th><th>Raw Material</th><th>Quantity</th><th>Unit</th><th>Base</th><th>Notes</th><th></th></tr></thead><tbody>{lines.map((line, index) => { const item = items.find(x => txt(x.id) === line.ingredient_item_id); return <tr key={`${line.sequence_number}-${index}`}><td>{index + 1}</td><td><select value={line.ingredient_item_id} onChange={e => chooseIngredient(index, e.target.value)}><option value="">Select raw material</option>{ingredientItems.map(option => <option key={txt(option.id)} value={txt(option.id)}>{txt(option.item_code || option.business_code)} — {txt(option.name)}</option>)}</select></td><td><input type="number" min="0.001" step="0.001" value={line.quantity} onChange={e => updateLine(index, { quantity: e.target.value })} placeholder="0.000" /></td><td>{line.unit_id ? unitLabel(line.unit_id) : txt(item?.base_unit_id) ? unitLabel(txt(item?.base_unit_id)) : 'Select item'}</td><td><button className={baseIngredientId === line.ingredient_item_id ? 'secondary-button tab-active' : 'secondary-button'} type="button" disabled={!line.ingredient_item_id} onClick={() => setBaseIngredientId(line.ingredient_item_id)}>{baseIngredientId === line.ingredient_item_id ? 'Base' : 'Set base'}</button></td><td><input value={line.notes} onChange={e => updateLine(index, { notes: e.target.value })} placeholder="Optional" /></td><td><button className="line-remove" type="button" disabled={lines.length === 1} onClick={() => removeLine(index)}>Remove</button></td></tr> })}</tbody></table></div>
      <button className="add-row-button" type="button" onClick={addLine}>+ Add raw material</button>
      {versions.length > 0 && <><div className="section-divider" /><div className="panel-heading"><h4>Version history</h4><span>{versions.length} version{versions.length === 1 ? '' : 's'}</span></div><div className="table-wrap"><table><thead><tr><th>Version</th><th>Status</th><th>Expected output</th><th>Base raw material</th><th>Created</th></tr></thead><tbody>{versions.map(version => { const base = items.find(item => txt(item.id) === txt(version.base_ingredient_item_id)); const unit = units.find(x => txt(x.id) === txt(version.output_unit_id)); return <tr key={txt(version.id)}><td>v{txt(version.version_number)}</td><td>{txt(version.status)}</td><td>{txt(version.expected_output_quantity)} {txt(unit?.symbol)}</td><td>{txt(base?.name)}</td><td>{txt(version.created_at).slice(0, 10)}</td></tr> })}</tbody></table></div></>}
      <Status message={message} error={error}/>
      <div className="purchase-actions"><button className="secondary-button" type="button" onClick={() => void save(false)} disabled={saving}>{saving ? 'Saving…' : 'Save Draft'}</button><button className="primary-button" type="button" onClick={() => void save(true)} disabled={saving}>{saving ? 'Saving…' : recipeId ? 'Save New Active Version' : 'Save & Activate'}</button></div>
    </div></div>}
  </div>
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="console-panel"><div className="panel-heading"><h3>{title}</h3></div>{children}</div>
}
