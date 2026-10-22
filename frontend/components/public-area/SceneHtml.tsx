'use client';

import { useMemo, type ComponentProps } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

/** Keep the DOM host stable while R3F connects its event source on startup. */
export function SceneHtml(props: ComponentProps<typeof Html>) {
  const { gl } = useThree();
  const portal = useMemo(() => ({ current: gl.domElement.parentElement! }), [gl]);
  return <Html {...props} portal={portal} />;
}
