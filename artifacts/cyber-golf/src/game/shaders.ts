// GOURAUD SHADING — lighting computed per-vertex, interpolated across face
export const gouraudVertexShader = `
uniform float time;
uniform float pulseAmp;
uniform float pulseSpeed;
uniform bool isObstacle;

varying vec3 vColor;
varying float vEmission;

void main() {
  vec3 pos = position;

  // Vertex shader scale animation (only for obstacles)
  float scale = 1.0;
  if (isObstacle) {
    scale = 1.0 + pulseAmp * sin(time * pulseSpeed * 6.28318);
    pos.xz *= scale;
  }

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vec3 worldNormal = normalize(normalMatrix * normal);

  // GOURAUD: compute lighting per vertex
  vec3 lightPos1 = vec3(10.0, 8.0, 5.0);
  vec3 lightPos2 = vec3(-8.0, 6.0, -3.0);
  vec3 lightColor1 = vec3(0.0, 0.9, 1.0);   // cyan
  vec3 lightColor2 = vec3(0.7, 0.0, 1.0);   // purple

  vec3 toLight1 = normalize(lightPos1 - worldPos.xyz);
  vec3 toLight2 = normalize(lightPos2 - worldPos.xyz);

  float diff1 = max(dot(worldNormal, toLight1), 0.0);
  float diff2 = max(dot(worldNormal, toLight2), 0.0);

  // Specular (Gouraud uses simplified per-vertex spec)
  vec3 viewDir = normalize(cameraPosition - worldPos.xyz);
  vec3 reflect1 = reflect(-toLight1, worldNormal);
  vec3 reflect2 = reflect(-toLight2, worldNormal);
  float spec1 = pow(max(dot(viewDir, reflect1), 0.0), 12.0);
  float spec2 = pow(max(dot(viewDir, reflect2), 0.0), 12.0);

  vec3 ambient = vec3(0.06, 0.04, 0.1);
  vec3 diffuse = diff1 * lightColor1 * 0.7 + diff2 * lightColor2 * 0.5;
  vec3 specular = spec1 * lightColor1 * 0.6 + spec2 * lightColor2 * 0.4;

  vColor = ambient + diffuse + specular;
  vEmission = isObstacle ? 0.3 + 0.2 * sin(time * pulseSpeed * 6.28318 + 1.0) : 0.0;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const gouraudFragmentShader = `
uniform vec3 baseColor;
uniform float emissiveStrength;

varying vec3 vColor;
varying float vEmission;

void main() {
  vec3 litColor = baseColor * vColor;
  vec3 emission = baseColor * (emissiveStrength + vEmission);
  gl_FragColor = vec4(litColor + emission, 1.0);
}
`;

// PHONG SHADING — lighting computed per-fragment (much smoother on curved surfaces)
export const phongVertexShader = `
uniform float time;
uniform float pulseAmp;
uniform float pulseSpeed;
uniform bool isObstacle;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vEmission;

void main() {
  vec3 pos = position;

  // Vertex shader scale animation for obstacles
  if (isObstacle) {
    float scale = 1.0 + pulseAmp * sin(time * pulseSpeed * 6.28318);
    pos.xz *= scale;
  }

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(normalMatrix * normal);
  vEmission = isObstacle ? 0.3 + 0.2 * sin(time * pulseSpeed * 6.28318 + 1.0) : 0.0;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const phongFragmentShader = `
uniform vec3 baseColor;
uniform float emissiveStrength;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vEmission;

void main() {
  vec3 N = normalize(vWorldNormal);

  // PHONG: full lighting per fragment (much smoother on spheres!)
  vec3 lightPos1 = vec3(10.0, 8.0, 5.0);
  vec3 lightPos2 = vec3(-8.0, 6.0, -3.0);
  vec3 lightColor1 = vec3(0.0, 0.9, 1.0);
  vec3 lightColor2 = vec3(0.7, 0.0, 1.0);

  vec3 toLight1 = normalize(lightPos1 - vWorldPos);
  vec3 toLight2 = normalize(lightPos2 - vWorldPos);

  float diff1 = max(dot(N, toLight1), 0.0);
  float diff2 = max(dot(N, toLight2), 0.0);

  // Per-fragment specular (shininess 64 — much better quality than Gouraud)
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 halfVec1 = normalize(toLight1 + viewDir);
  vec3 halfVec2 = normalize(toLight2 + viewDir);
  float spec1 = pow(max(dot(N, halfVec1), 0.0), 64.0);
  float spec2 = pow(max(dot(N, halfVec2), 0.0), 64.0);

  vec3 ambient = vec3(0.06, 0.04, 0.1);
  vec3 diffuse = diff1 * lightColor1 * 0.7 + diff2 * lightColor2 * 0.5;
  vec3 specular = spec1 * lightColor1 * 0.8 + spec2 * lightColor2 * 0.6;

  vec3 litColor = baseColor * (ambient + diffuse) + specular;
  vec3 emission = baseColor * (emissiveStrength + vEmission);

  gl_FragColor = vec4(litColor + emission, 1.0);
}
`;

// Emissive floor/border shader
export const emissiveVertexShader = `
varying vec3 vWorldPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const emissiveFragmentShader = `
uniform vec3 glowColor;
uniform float time;
uniform float intensity;

varying vec3 vWorldPos;

void main() {
  // Grid-line glow effect
  float gridX = abs(fract(vWorldPos.x * 0.5) - 0.5);
  float gridZ = abs(fract(vWorldPos.z * 0.5) - 0.5);
  float grid = max(
    smoothstep(0.45, 0.5, gridX),
    smoothstep(0.45, 0.5, gridZ)
  );

  float pulse = 0.5 + 0.5 * sin(time * 1.5);
  vec3 baseColor = vec3(0.02, 0.01, 0.06);
  vec3 emissive = glowColor * grid * (intensity + pulse * 0.3);

  gl_FragColor = vec4(baseColor + emissive, 1.0);
}
`;

// Ball shader with strong emissive (glows regardless of external light)
export const ballVertexShader = `
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const ballFragmentShader = `
uniform vec3 ballColor;
uniform float time;
uniform bool usePhong;

varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vec3 N = normalize(vNormal);

  if (usePhong) {
    // Phong: per-fragment lighting
    vec3 lightPos = vec3(10.0, 8.0, 5.0);
    vec3 lightDir = normalize(lightPos - vWorldPos);
    float diff = max(dot(N, lightDir), 0.0);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 halfVec = normalize(lightDir + viewDir);
    float spec = pow(max(dot(N, halfVec), 0.0), 80.0);
    vec3 lit = ballColor * (0.2 + diff * 0.6) + vec3(1.0) * spec * 0.7;
    // Strong emissive so balls glow
    vec3 emission = ballColor * 0.5 * (0.8 + 0.2 * sin(time * 3.0));
    gl_FragColor = vec4(lit + emission, 1.0);
  } else {
    // Gouraud approximation in fragment (using N only, no per-frag shading)
    float ndotup = dot(N, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
    vec3 lit = ballColor * (0.3 + ndotup * 0.7);
    vec3 emission = ballColor * 0.5 * (0.8 + 0.2 * sin(time * 3.0));
    gl_FragColor = vec4(lit + emission, 1.0);
  }
}
`;
