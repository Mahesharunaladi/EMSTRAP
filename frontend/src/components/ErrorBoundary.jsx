import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[EmSTraP ErrorBoundary caught error]:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-center text-slate-800">
          <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-600">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-bold">Something went wrong</h2>
            <p className="mt-2 text-xs text-slate-500">
              A temporary display error occurred. Your session and data are secure.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="mt-5 w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white shadow hover:bg-slate-800"
            >
              Refresh Application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
