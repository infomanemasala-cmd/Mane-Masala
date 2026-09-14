'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main style={{ padding: '2rem', maxWidth: 720 }}>
      <h1>Something went wrong</h1>
      <p>The application could not complete this request.</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  )
}
