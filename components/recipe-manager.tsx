'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect from '@/components/searchable-select'

type Row = Record<string, any>
type Line = { ingredient_item_id: string; quantity: string; unit_id: string; sequence_number: number; notes: string }
const db = () => createClient()
const txt = (v: any) => String(v ?? '')
const num = (v: any) => Number(v ?? 0)
const blankLine = (n: number): Line => ({ ingredient_item_id: '', quantity: '', unit_id: '', sequence_number: n, notes: '' })

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function Status({ message, error }: { message: string; error: boolean }) { return message ? <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p> : null }

export default function RecipeManager() {
  const [items, setItems] = useState<Row[]>([]), [units, setUnits] = useState<Row[]>([]), [recipes, setRecipes] = useState<Row[]>([])
  const [showArchived, setShowArchived] = useState(false), [search, setSearch] = useState(''), [selected, setSelected] = useState<string[]>([]), [pendingArchive, setPendingArchive] = useState(false)
  const [open, setOpen] = useState(false), [recipeId, setRecipeId] = useState(''), [recipeCode, setRecipeCode] = useState('')
  const [name, setName] = useState(''), [outputItemId, setOutputItemId] = useState(''), [expectedOutput, setExpectedOutput] = useState(''), [outputUnitId, setOutputUnitId] = useState(''), [baseIngredientId, setBaseIngredientId] = useState(''), [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([blankLine(1)]), [versions, setVersions] = useState<Row[]>([]), [message, setMessage] = useState(''), [error, setError] = useState(false), [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: itemRows, error: ie }, { data: unitRows, error: ue }, { data: recipeRows, error: re }] = await Promise.all([
      db().from('items').select('*').eq('is_active', true).order('name'),
      db().from('units').select('id,name,symbol,code').eq('is_active', true).order('name'),
      db().from('recipes').select('id,business_code,name,status,output_item_id,created_at,updated_at').order('business_code'),
    ])
    if (ie || ue || re) { setError(true); setMessage((ie || ue || re)?.message ?? 'Unable to load recipe data.'); return }
    setItems(itemRows ?? []); setUnits(unitRows ?? []); setRecipes(recipeRows ?? [])
  }
  useEffect(() => { void load() }, [])

  const visibleRecipes = useMemo(() => {
    const q = search.trim().toLocaleLowerCase()
    return recipes.filter(r => (showArchived ? r.status !== 'active' : r.status === 'active') && (!q || `${txt(r.business_code)} ${txt(r.name)}`.toLocaleLowerCase().includes(q)))
  }, [recipes, search, showArchived])
  const ingredientItems = items.filter(item => item.can_be_used_in_production !== false)
  const itemOptions = items.map(item => ({ value: txt(item.id), label: `${txt(item.item_code || item.business_code)} — ${txt(item.name)}`, code: txt(item.item_code || item.business_code), name: txt(item.name) }))
  const unitLabel = (id: string) => { const u = units.find(x => txt(x.id) === id); return u ? \`\${txt(u.name)} (\${txt(u.symbol)})\` : '' }
  const unitForItem = (id: string) => txt(items.find(item => txt(item.id) === id)?.base_unit_id)

  const reset = () => { setOpen(false); setRecipeId(''); setRecipeCode(''); setName(''); setOutputItemId(''); setExpectedOutput(''); setOutputUnitId(''); setBaseIngredientId(''); setNotes(''); setLines([blankLine(1)]); setVersions([]); setMessage(''); setError(false) }
  const startNew = () => { setRecipeId(''); setRecipeCode(''); setName(''); setOutputItemId(''); setExpectedOutput(''); setOutputUnitId(''); setBaseIngredientId(''); setNotes(''); setLines([blankLine(1)]); setVersions([]); setMessage(''); setError(false); setOpen(true) }

  const openRecipe = async (row: Row) => {
    setOpen(true); setMessage(''); setError(false); setRecipeId(txt(row.id)); setRecipeCode(txt(row.business_code)); setName(txt(row.name)); setOutputItemId(txt(row.output_item_id))
    const { data: versionRows, error: ve } = await db().from('recipe_versions').select('*').eq('recipe_id', row.id).order('version_number', { ascending: false })
    if (ve) { setError(true); setMessage(ve.message); return }
    setVersions(versionRows ?? [])
    const active = (versionRows ?? []).find(v => txt(v.status) === 'active') ?? versionRows?.[0]
    if (!active) { setExpectedOutput(''); setOutputUnitId(''); setBaseIngredientId(''); setNotes(''); setLines([blankLine(1)]); return }
    setExpectedOutput(txt(active.expected_output_quantity)); setOutputUnitId(txt(active.output_unit_id)); setBaseIngredientId(txt(active.base_ingredient_item_id)); setNotes(txt(active.notes))
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
    const { data, error: e } = await db().rpc('save_recipe_version', { p_recipe_id: recipeId || null, p_name: name.trim(), p_output_item_id: outputItemId, p_base_ingredient_item_id: baseIngredientId, p_expected_output_quantity: num(expectedOutput), p_output_unit_id: outputUnitId, p_lines: clean, p_notes: notes.trim() || null, p_activate: activate, p_effective_from: new Date().toISOString().slice(0, 10) })
    setSaving(false)
    if (e) { setError(true); setMessage(e.message); return }
    setRecipeId(txt(data?.recipe_id)); setMessage(activate ? 'Recipe version saved and activated.' : 'Recipe version saved as draft.'); await load()
    const { data: refreshed } = await db().from('recipe_versions').select('*').eq('recipe_id', data?.recipe_id).order('version_number', { ascending: false }); setVersions(refreshed ?? [])
  }

  const archive = async () => {
    if (!selected.length) return
    if (!window.confirm(\`Archive \${selected.length} selected recipe\${selected.length === 1 ? '' : 's'}? Historical versions will remain.\`)) return
    setSaving(true); setMessage(''); setError(false)
    for (const id of selected) { const { error: e } = await db().rpc('archive_recipe', { p_recipe_id: id, p_reason: 'Archived from Recipe Master' }); if (e) { setSaving(false); setError(true); setMessage(e.message); setPendingArchive(false); return } }
    setSelected([]); setSaving(false); setPendingArchive(false); setMessage('Recipe archived successfully.'); await load()
  }
  const restore = async (id: string) => {
    if (!window.confirm('Restore this recipe to the active list?')) return
    setSaving(true); setMessage(''); setError(false); const { error: e } = await db().rpc('restore_recipe', { p_recipe_id: id }); setSaving(false)
    if (e) { setError(true); setMessage(e.message); return } setMessage('Recipe restored successfully.'); await load()
  }

  return <div>
    <div className="master-header"><div><h2>Recipes</h2><p>Search, edit, version, archive and restore recipes. Historical versions stay unchanged when a new version is saved.</p></div><div className="table-toolbar-right"><button className="secondary-button" type="button" onClick={() => { setShowArchived(v => !v); setSelected([]) }}>{showArchived ? 'Active Recipes' : 'Archived Recipes'}</button><button className="secondary-button" type="button" disabled={!selected.length || showArchived || saving} onClick={() => setPendingArchive(true)}>Archive{selected.length ? \` (\${selected.length})\` : ''}</button><button className="primary-button" type="button" onClick={startNew}>+ Create Recipe</button></div></div>
    <div className="data-table"><div className="table-toolbar"><input className="table-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipe code or name…" aria-label="Search recipes by code or name"/><span className="table-count">{visibleRecipes.length} recipe{visibleRecipes.length === 1 ? '' : 's'}</span></div><div className="table-wrap"><table><thead><tr>{!showArchived && <th><input type="checkbox" aria-label="Select all visible recipes" checked={visibleRecipes.length > 0 && visibleRecipes.every(r => selected.includes(txt(r.id)))} onChange={e => setSelected(e.target.checked ? visibleRecipes.map(r => txt(r.id)) : [])}/></th>}<th>Code</th><th>Recipe</th><th>Status</th><th>Output</th><th>Action</th></tr></thead><tbody>{visibleRecipes.map(row => <tr key={txt(row.id)}>{!showArchived && <td><input type="checkbox" checked={selected.includes(txt(row.id))} onChange={e => setSelected(v => e.target.checked ? [...new Set([...v,txt(row.id)])] : v.filter(id => id !== txt(row.id)))} aria-label={\`Select \${txt(row.name)}\`}/></td>}<td>{txt(row.business_code)}</td><td>{txt(row.name)}</td><td>{txt(row.status)}</td><td>{txt(items.find(i => txt(i.id) === txt(row.output_item_id))?.item_code || items.find(i => txt(i.id) === txt(row.output_item_id))?.business_code)} — {txt(items.find(i => txt(i.id) === txt(row.output_item_id))?.name)}</td><td>{showArchived ? <button className="secondary-button" type="button" onClick={() => void restore(txt(row.id))} disabled={saving}>Restore</button> : <button className="secondary-button" type="button" onClick={() => void openRecipe(row)}>Edit</button>}</td></tr>)}{!visibleRecipes.length && <tr><td colSpan={showArchived ? 6 : 7} className="table-message">No recipes found.</td></tr>}</tbody></table></div></div>
    {message && <Status message={message} error={error}/>}
    {pendingArchive && <div className="modal-backdrop" role="presentation"><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="archive-recipe-title"><div className="modal-header"><h3 id="archive-recipe-title">Archive selected recipes?</h3><button className="secondary-button" type="button" onClick={() => setPendingArchive(false)} disabled={saving}>Cancel</button></div><p className="muted">{selected.length} selected recipe{selected.length === 1 ? '' : 's'} will leave the active list but remain in history. Recipes used by active production batches will be blocked safely.</p><div className="purchase-actions"><button className="secondary-button" type="button" onClick={() => setPendingArchive(false)} disabled={saving}>Cancel</button><button className="primary-button" type="button" onClick={() => void archive()} disabled={saving}>{saving ? 'Archiving…' : 'Confirm Archive'}</button></div></div></div>}
    {open && <div className="modal-backdrop"><div className="modal-card purchase-modal">
      <div className="modal-header"><div><h3>{recipeId ? \`Recipe \${recipeCode}\` : 'Create Recipe'}</h3><p className="muted">Saving an active recipe creates a new version; existing production versions are never overwritten.</p></div><button className="secondary-button" type="button" onClick={reset} disabled={saving}>Close</button></div>
      <div className="form-grid">
        <Field label="Recipe name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Finished / output item"><SearchableSelect value={outputItemId} options={itemOptions.filter(i => items.find(x => txt(x.id) === i.value)?.can_be_sold)} onChange={setOutputItemId} placeholder="Select finished product" ariaLabel="Finished output item"/></Field>
        <Field label="Expected finished output"><input type="number" min="0.001" step="0.001" value={expectedOutput} onChange={e => setExpectedOutput(e.target.value)} placeholder="Required production standard" /></Field>
        <Field label="Output unit"><SearchableSelect value={outputUnitId} options={units.map(u => ({value:txt(u.id),label:\`\${txt(u.code)} — \${txt(u.name)} (\${txt(u.symbol)})\`,code:txt(u.code),name:txt(u.name)}))} onChange={setOutputUnitId} placeholder="Select output unit"/></Field>
        <Field label="Base raw material"><SearchableSelect value={baseIngredientId} options={lines.filter(line => line.ingredient_item_id).map(line => { const item=items.find(x=>txt(x.id)===line.ingredient_item_id); return {value:line.ingredient_item_id,label:\`\${txt(item?.item_code || item?.business_code)} — \${txt(item?.name)} · \${line.quantity} \${unitLabel(line.unit_id)}\`,code:txt(item?.item_code || item?.business_code),name:txt(item?.name)} })} onChange={setBaseIngredientId} placeholder="Select base ingredient"/></Field>
        <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      </div>
      <div className="section-divider" /><div className="panel-heading"><h4>Raw material standard</h4><span>Search by code or name. Each line uses the item's standard base unit.</span></div>
      <div className="table-wrap"><table><thead><tr><th>SL NO</th><th>Raw Material</th><th>Quantity</th><th>Unit</th><th>Base</th><th>Notes</th><th></th></tr></thead><tbody>{lines.map((line,index)=>{const item=items.find(x=>txt(x.id)===line.ingredient_item_id);return <tr key={\`\${line.sequence_number}-\${index}\`}><td>{index+1}</td><td><SearchableSelect value={line.ingredient_item_id} options={itemOptions.filter(o=>ingredientItems.some(i=>txt(i.id)===o.value))} onChange={value=>chooseIngredient(index,value)} placeholder="Search ingredient" ariaLabel={\`Ingredient \${index+1}\`}/></td><td><input type="number" min="0.001" step="0.001" value={line.quantity} onChange={e=>updateLine(index,{quantity:e.target.value})}/></td><td>{line.unit_id?unitLabel(line.unit_id):txt(item?.base_unit_id)?unitLabel(txt(item?.base_unit_id)):'Select item'}</td><td><button className={baseIngredientId===line.ingredient_item_id?'secondary-button tab-active':'secondary-button'} type="button" disabled={!line.ingredient_item_id} onClick={()=>setBaseIngredientId(line.ingredient_item_id)}>{baseIngredientId===line.ingredient_item_id?'Base':'Set base'}</button></td><td><input value={line.notes} onChange={e=>updateLine(index,{notes:e.target.value})}/></td><td><button className="line-remove" type="button" disabled={lines.length===1} onClick={()=>removeLine(index)}>Remove</button></td></tr>})}</tbody></table></div>
      <button className="add-row-button" type="button" onClick={addLine}>+ Add raw material</button>
      {versions.length>0&&<><div className="section-divider"/><div className="panel-heading"><h4>Version history</h4><span>{versions.length} version{versions.length===1?'':'s'}</span></div><div className="table-wrap"><table><thead><tr><th>Version</th><th>Status</th><th>Expected output</th><th>Base raw material</th><th>Created</th></tr></thead><tbody>{versions.map(v=>{const base=items.find(i=>txt(i.id)===txt(v.base_ingredient_item_id));const unit=units.find(u=>txt(u.id)===txt(v.output_unit_id));return <tr key={txt(v.id)}><td>v{txt(v.version_number)}</td><td>{txt(v.status)}</td><td>{txt(v.expected_output_quantity)} {txt(unit?.symbol)}</td><td>{txt(base?.item_code||base?.business_code)} — {txt(base?.name)}</td><td>{txt(v.created_at).slice(0,10)}</td></tr>})}</tbody></table></div></>}
      <Status message={message} error={error}/><div className="purchase-actions"><button className="secondary-button" type="button" onClick={()=>void save(false)} disabled={saving}>{saving?'Saving…':'Save Draft'}</button><button className="primary-button" type="button" onClick={()=>void save(true)} disabled={saving}>{saving?'Saving…':recipeId?'Save New Active Version':'Save & Activate'}</button></div>
    </div></div>}
  </div>
}
