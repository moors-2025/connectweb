import { Component } from "react";

// Class component is required here — error boundaries cannot be written as
// hooks/function components in React. Catches render errors in its subtree
// so one broken page can't blank the whole app.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled error in UI:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg px-6 py-16 text-center">
          <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink/70">
            This page hit an unexpected error. Try reloading, or go back and try again.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-6 rounded bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-dark"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
