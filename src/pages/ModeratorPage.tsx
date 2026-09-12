import ModeratorControls from '../components/Moderator/ModeratorControls'
import PageHeader from '../components/shared/PageHeader'
import type { GameState } from '../hooks/useGameState'

export default function ModeratorPage({ game, onShowWall }: { game: GameState; onShowWall: () => void }) {
  return <div className="page"><PageHeader eyebrow="Control room / 02" title="Call the play." description="Keep the room moving, award points, and send the next prompt to the wall." /><section className="panel prompt-panel"><span className="eyebrow">Live prompt</span><p className="category">{game.question.category}</p><h2>{game.question.prompt}</h2><p className="muted">Answer: {game.question.answer}</p><ModeratorControls game={game} /></section><div className="score-line"><span>Current score</span><strong>{game.score} points</strong><button className="secondary-button" type="button" onClick={onShowWall}>Open LED wall</button></div></div>
}
