import { FileImage, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { uploadEmergencyEvidence } from '../services/emergencySocket'

export default function EvidenceUploadModal({ onClose }) {
  const inputRef = useRef(null); const [files, setFiles] = useState([])
  const choose = event => setFiles(Array.from(event.target.files || []))
  const submit = () => { uploadEmergencyEvidence({ incidentId: 'EM-2048', files: files.map(file => ({ name: file.name, type: file.type, size: file.size })) }); toast.success(`${files.length || 1} evidence file${files.length === 1 ? '' : 's'} added to the incident`); onClose() }
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div className="w-full max-w-md rounded-t-3xl border border-slate-700 bg-slate-900 p-5 sm:rounded-3xl"><div className="mb-6 flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-amber-400">Incident #EM-2048</p><h2 className="mt-1 font-display text-xl font-bold">Upload evidence</h2></div><button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800"><X size={19} /></button></div><button onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-600 bg-slate-950/70 px-4 py-10 text-center hover:border-red-400"><span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-red-400"><FileImage size={23} /></span><span className="font-semibold">{files.length ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Choose incident photos'}</span><span className="mt-1 text-xs text-slate-500">JPG, PNG or HEIC · up to 10 MB each</span></button><input ref={inputRef} onChange={choose} type="file" accept="image/*" multiple className="hidden" /><button onClick={submit} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3.5 font-bold text-white hover:bg-red-400"><Upload size={17} /> Upload evidence</button></div></div>
}
