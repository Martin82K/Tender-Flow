import React from "react";

interface Props {
  moduleTitle: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ModuleErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  declare state: State;

  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[CommandCenter] Module crashed:`, error, info);
  }

  render() {
    const props = this.props;
    const state = this.state;
    if (state.error) {
      return (
        <div className="cc-panel cc-panel--error">
          <div className="cc-panel__head">
            <span className="cc-panel__title cc-panel__title--red">
              Modul: {props.moduleTitle}
            </span>
          </div>
          <div className="cc-panel__body cc-panel__empty">
            Modul se nepodařilo načíst. Zkuste obnovit stránku nebo ho vypnout v nastavení.
          </div>
        </div>
      );
    }
    return props.children as React.ReactElement;
  }
}
