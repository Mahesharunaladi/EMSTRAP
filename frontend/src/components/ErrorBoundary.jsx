import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, showDetails: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[EmSTraP ErrorBoundary caught error]:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || String(this.state.error || 'Unknown runtime error')
      const isNetworkOrCors = errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('failed to fetch') ||
        errorMessage.toLowerCase().includes('cors')

      return (
        <div className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-center text-slate-800">
          <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-600">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-bold">
              {isNetworkOrCors ? 'Connection Error' : 'Display Notice'}
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {isNetworkOrCors
                ? 'Unable to communicate with the emergency dispatch server. Please verify your internet connection.'
                : 'A temporary display issue occurred. Your session and data remain completely secure.'}
            </p>

            <div className="mt-4 text-left">
              <button
                type="button"
                onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 underline"
              >
                {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
              </button>
              {this.state.showDetails && (
                <div className="mt-2 max-h-36 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] font-mono text-red-300">
                  <p className="font-bold text-white">Error: {errorMessage}</p>
                  {this.state.error?.stack && (
                    <pre className="mt-1 text-[10px] text-slate-400 whitespace-pre-wrap">
                      {String(this.state.error.stack)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="mt-5 w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white shadow hover:bg-slate-800 transition active:scale-[0.98]"
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
