import { Check, SkipForward } from 'lucide-react'
import type { GameState } from '../../hooks/useGameState'

export default function ModeratorControls({ game }: { game: GameState }) {
  return <div className="control-row"><button className="primary-button" type="button" onClick={game.addPoint}><Check size={17} /> Award point</button><button className="secondary-button" type="button" onClick={game.nextQuestion}><SkipForward size={17} /> Next question</button></div>
}
