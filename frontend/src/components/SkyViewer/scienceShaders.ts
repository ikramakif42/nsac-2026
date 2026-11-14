export const SCIENCE_VERTEX_SHADER = `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 position;
  if (gl_VertexID == 0) {
    position = vec2(-1.0, -1.0);
  } else if (gl_VertexID == 1) {
    position = vec2(3.0, -1.0);
  } else {
    position = vec2(-1.0, 3.0);
  }

  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const SCIENCE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uPlane;
uniform int uStretch;
uniform int uColormap;
uniform bool uDifference;

in vec2 vUv;
out vec4 outColor;

float displayStretch(float value) {
  float x = clamp(value, 0.0, 1.0);

  if (uStretch == 1) {
    return sqrt(x);
  }
  if (uStretch == 2) {
    return log(1.0 + 1000.0 * x) / log(1001.0);
  }
  if (uStretch == 3) {
    float z = 10.0 * x;
    return log(z + sqrt(z * z + 1.0))
      / log(10.0 + sqrt(101.0));
  }
  return x;
}

// Interpolated display palettes. These are colors, not flux transforms.
vec3 inferno(float x) {
  const vec3 colors[6] = vec3[6](
    vec3(0.001, 0.000, 0.014),
    vec3(0.258, 0.039, 0.406),
    vec3(0.578, 0.148, 0.404),
    vec3(0.865, 0.317, 0.226),
    vec3(0.988, 0.645, 0.040),
    vec3(0.988, 0.998, 0.645)
  );
  float position = clamp(x, 0.0, 1.0) * 5.0;
  int index = min(int(floor(position)), 4);
  return mix(colors[index], colors[index + 1], position - float(index));
}

vec3 viridis(float x) {
  const vec3 colors[6] = vec3[6](
    vec3(0.267, 0.005, 0.329),
    vec3(0.254, 0.265, 0.530),
    vec3(0.164, 0.471, 0.558),
    vec3(0.135, 0.659, 0.518),
    vec3(0.478, 0.821, 0.318),
    vec3(0.993, 0.906, 0.144)
  );
  float position = clamp(x, 0.0, 1.0) * 5.0;
  int index = min(int(floor(position)), 4);
  return mix(colors[index], colors[index + 1], position - float(index));
}

void main() {
  vec2 pixel = texture(uPlane, vUv).rg;
  if (pixel.g < 0.5) {
    discard;
  }

  if (uDifference) {
    float magnitude = displayStretch(abs(pixel.r));
    vec3 signColor = pixel.r < 0.0
      ? vec3(0.220, 0.741, 0.973)
      : vec3(0.984, 0.573, 0.235);

    // Exact zero is black. Both signs receive the identical magnitude stretch.
    outColor = vec4(signColor * magnitude, 1.0);
    return;
  }

  float value = displayStretch(pixel.r);
  vec3 color = vec3(value);
  if (uColormap == 1) {
    color = inferno(value);
  } else if (uColormap == 2) {
    color = viridis(value);
  }

  outColor = vec4(color, 1.0);
}
`;