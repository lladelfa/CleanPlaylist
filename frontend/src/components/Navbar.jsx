import React from 'react';
import GlobalHeader from './GlobalHeader';

/**
 * Navbar (Deprecated)
 * Re-exports GlobalHeader for backward compatibility.
 */
export default function Navbar(props) {
  return (
    <GlobalHeader
      activeTab={props.activeTab}
      setActiveTab={props.setActiveTab}
      activePlatform={props.activePlatform}
      onSelectPlatform={props.setActivePlatform || props.onSelectPlatform}
    />
  );
}
