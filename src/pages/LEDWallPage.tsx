import QuestionDisplay from '../components/LEDWall/QuestionDisplay'
import type { GameState } from '../hooks/useGameState'

export default function LEDWallPage({ game }: { game: GameState }) {
  return <div className="wall-page"><QuestionDisplay game={game} /></div>
}
