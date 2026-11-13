import React from 'react';

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
}

export const Image: React.FC<ImageProps> = ({
  fill,
  priority,
  sizes,
  className = '',
  style,
  alt = '',
  loading,
  ...props
}) => {
  const fillStyle: React.CSSProperties = fill
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        ...style,
      }
    : (style || {});

  return (
    <img
      alt={alt}
      className={className}
      style={fillStyle}
      loading={priority ? 'eager' : (loading || 'lazy')}
      {...props}
    />
  );
};

export default Image;
