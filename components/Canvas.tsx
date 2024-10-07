type Props = {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
};

const Canvas = ({ canvasRef }: Props) => {
  return (
    <div
      id="canvas"
      className="relative flex h-full w-full flex-1 items-center justify-center"
    >
      <canvas ref={canvasRef} />
    </div>
  );
};

export default Canvas;
