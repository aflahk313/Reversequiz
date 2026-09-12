import { Play } from 'lucide-react'

export default function SetupForm({ onStart }: { onStart: () => void }) {
  return <section className="panel setup-form"><label>Game name<input defaultValue="Friday Night Reverse Quiz" /></label><label>Team name<input defaultValue="The Curious Minds" /></label><button className="primary-button" type="button" onClick={onStart}><Play size={17} /> Start game</button></section>
}
