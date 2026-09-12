import type { GameState } from '../../hooks/useGameState'

export default function QuestionDisplay({ game }: { game: GameState }) {
  return <section className="led-screen"><span className="screen-label">Question {game.questionIndex + 1} / {game.questionCount}</span><p className="category">{game.question.category}</p><h1>{game.question.prompt}</h1><p className="answer">Answer: <strong>{game.question.answer}</strong></p></section>
}
