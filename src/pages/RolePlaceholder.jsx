import { ShieldCheck } from 'lucide-react'
import AppShell from '../components/AppShell'
export default function RolePlaceholder({ role }) { return <AppShell title={role}><div className="grid min-h-[60vh] place-items-center text-center"><div><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-slate-800 text-slate-400"><ShieldCheck size={28} /></div><h1 className="font-display text-2xl font-bold">{role} dashboard</h1><p className="mt-2 text-slate-400">This role workspace is ready for the next implementation phase.</p></div></div></AppShell> }
