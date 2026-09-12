export type QuizQuestion = {
  id: string
  answer: string
  prompt: string
  category: string
}

export const quizQuestions: QuizQuestion[] = [
  { id: 'q1', answer: 'The Moon', prompt: 'What has no atmosphere, yet controls the tides?', category: 'Space' },
  { id: 'q2', answer: 'A keyboard', prompt: 'What has keys but cannot open a lock?', category: 'Riddles' },
  { id: 'q3', answer: 'The Pacific Ocean', prompt: 'What is the largest ocean on Earth?', category: 'Geography' },
]
