import { useState } from 'react'
import { quizQuestions } from '../data/quizData'

export function useGameState() {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const question = quizQuestions[questionIndex]

  return {
    question,
    questionIndex,
    questionCount: quizQuestions.length,
    score,
    nextQuestion: () => setQuestionIndex((current) => (current + 1) % quizQuestions.length),
    addPoint: () => setScore((current) => current + 1),
  }
}

export type GameState = ReturnType<typeof useGameState>
