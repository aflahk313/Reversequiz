import PageHeader from '../components/shared/PageHeader'
import SetupForm from '../components/Setup/SetupForm'
import type { GameState } from '../hooks/useGameState'

export default function SetupPage({ onStart, game }: { onStart: () => void; game: GameState }) {
  return <div className="page"><PageHeader eyebrow="Control room / 01" title="Set the stage." description="Create a room, choose a team, and get your reverse quiz ready." /><div className="setup-grid"><SetupForm onStart={onStart} /><aside className="stat-panel"><span>Question bank</span><strong>{game.questionCount}</strong><small>curated prompts ready</small></aside></div></div>
}
