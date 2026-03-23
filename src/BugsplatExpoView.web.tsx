import * as React from 'react';

import { BugsplatExpoViewProps } from './BugsplatExpo.types';

export default function BugsplatExpoView(props: BugsplatExpoViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
