import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface SignatureCanvasProps {
  width?: number;
  height?: number;
  strokeWidth?: number;
  strokeColor?: string;
  backgroundColor?: string;
}

export interface SignatureCanvasRef {
  clear: () => void;
  getSignature: () => string | null;
}

export const SignatureCanvas = forwardRef<SignatureCanvasRef, SignatureCanvasProps>(
  ({ width = 300, height = 200, strokeWidth = 2, strokeColor = '#000', backgroundColor = '#ffffff' }, ref) => {
    const pathsRef = useRef<Array<{ d: string }>>([]);
    const currentPathRef = useRef('');
    const lastPointRef = useRef({ x: 0, y: 0 });
    const [, forceUpdate] = React.useState(0);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          currentPathRef.current = `M ${locationX} ${locationY}`;
          lastPointRef.current = { x: locationX, y: locationY };
        },

        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const last = lastPointRef.current;

          // Smooth curve using quadratic bezier
          const midX = (last.x + locationX) / 2;
          const midY = (last.y + locationY) / 2;
          currentPathRef.current += ` Q ${last.x} ${last.y} ${midX} ${midY}`;

          lastPointRef.current = { x: locationX, y: locationY };
          forceUpdate((n) => n + 1);
        },

        onPanResponderRelease: () => {
          if (currentPathRef.current) {
            pathsRef.current.push({ d: currentPathRef.current });
            currentPathRef.current = '';
            forceUpdate((n) => n + 1);
          }
        },
      })
    ).current;

    useImperativeHandle(ref, () => ({
      clear: () => {
        pathsRef.current = [];
        currentPathRef.current = '';
        forceUpdate((n) => n + 1);
      },
      getSignature: (): string | null => {
        if (pathsRef.current.length === 0) return null;
        return JSON.stringify(pathsRef.current);
      },
    }));

    const renderPaths = () => {
      const allPaths = [...pathsRef.current];
      if (currentPathRef.current) {
        allPaths.push({ d: currentPathRef.current });
      }
      return allPaths;
    };

    return (
      <View style={[styles.container, { width, height, backgroundColor }]} {...panResponder.panHandlers}>
        <Svg width={width} height={height}>
          {renderPaths().map((path, index) => (
            <Path
              key={index}
              d={path.d}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </View>
    );
  }
);

SignatureCanvas.displayName = 'SignatureCanvas';

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
