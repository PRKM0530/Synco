import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#f0f4ff",
            minHeight: "100vh",
            color: "#1a1a2e",
          }}
        >
          <h1 style={{ color: "#c0392b" }}>Something went wrong</h1>
          <p>An unexpected error occurred while rendering this page.</p>
          <pre
            style={{
              color: "#7f1d1d",
              background: "#fef2f2",
              padding: "15px",
              borderRadius: "8px",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.error?.toString()}
          </pre>
          <br />
          <pre
            style={{
              color: "#555",
              fontSize: "12px",
              background: "#f5f5f5",
              padding: "15px",
              borderRadius: "8px",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.errorInfo?.componentStack}
          </pre>
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              background: "#2B4C8C",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
