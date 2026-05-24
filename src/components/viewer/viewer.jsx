import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1} />;
}

export default function Viewer({ modelUrl }) {
  return (
    <div style={{ height: "400px", width: "100%" }}>
      <Canvas camera={{ position: [0, 1, 3] }}>
        <ambientLight intensity={1} />
        <directionalLight position={[2, 2, 2]} />
        <OrbitControls />
        <Model url={modelUrl} />
      </Canvas>
    </div>
  );
}