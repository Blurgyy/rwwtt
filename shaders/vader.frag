#version 450
#extension GL_ARB_separate_shader_objects : enable
layout(binding = 0) uniform UniformBufferObject{
    vec2 res;
    float time;
} passedInfo;
layout(location = 0) out vec4 outColor;
const int MAXSTEPS = 100;
const float MAXDIST = 1e8;
const float EPS = 1e-3;

// ------------------------------------------------

float sdSphere(vec3 p, vec4 sph){
    p -= sph.xyz;
    return length(p) - sph.w;
}
float sdBox(vec3 p, vec3 rad){
    vec3 q = abs(p) - rad;
    return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.);
}
float sdRoundBox(vec3 p, vec3 rad, float r){
    vec3 q = abs(p) - rad;
    return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r;
}
float sdPlane(vec3 p){
    return -p.y;
}

// ------------------------------------------------

float map(vec3 p){
    vec3 q = vec3(fract(p.x + 0.5) - 0.5, p.yz);
    return min(
        sdBox(q-vec3(0, -0.25, 0), vec3(0.2, 0.25, 0.2)),
        // sdRoundBox(q-vec3(0, -0.25, 0), vec3(0.2, 0.15, 0.2), 0.1),
        sdPlane(p)
    );
}

vec3 getNormal(vec3 p){
    // vec2 e = vec2(1.0,-1.0)*0.5773*0.0005;
    // return normalize( e.xyy*map( p + e.xyy ) + 
	// 				  e.yyx*map( p + e.yyx ) + 
	// 				  e.yxy*map( p + e.yxy ) + 
	// 				  e.xxx*map( p + e.xxx ) );
    vec2 eps = vec2(EPS, 0);
    vec3 n = vec3(
    	map(p + eps.xyy) - map(p - eps.xyy),
        map(p + eps.yxy) - map(p - eps.yxy),
        map(p + eps.yyx) - map(p - eps.yyx));
    return normalize(n);
}

float castRay(vec3 ro, vec3 rd){
    float tmin = 1.0;
    float tmax = MAXDIST;

    float t = tmin;
    for(int i = 0; i < MAXSTEPS; ++ i){
        if(t > tmax){
            break;
        }
        float adaptive_eps = 1e-4 * t; // !
        vec3 pos = ro + t * rd;
        float delta = map(pos);
        if(delta < adaptive_eps){
            break;
        }
        t += delta;
    }
    if(t > tmax){
        t = -1.0;
    }
    return t;
}

float softShadow(vec3 ro, vec3 rd, float tmin, float tmax){
    // use tmin > 0 to prevent rays stop without leaving local area
    float ret = 1.0;
    float t = tmin;
    for(int i = 0; i < MAXSTEPS; ++ i){
        vec3 pos = ro + t * rd;
        float h = map(pos);
        // ret = min(ret, 10 * h / t);
        ret = min(ret, 10*h/t);
        t += clamp(h, 0.01, 0.5);
        if(t > tmax || ret < 1e-4){
            break;
        }
    }
    return clamp(ret, 0, 1);
}

// rendering process, returns color
vec3 render(vec3 ro, vec3 rd){
    vec3 ret_color = vec3(0);

    float t = castRay(ro, rd);

    if(t > 0.5){
        vec3 pos = ro + t * rd;
        vec3 n = getNormal(pos);
        
        // vec3 l = normalize(vec3(-1, -3, -5)-pos);
        vec3 l = normalize(vec3(-1, -3, -5)); // parallel light rays
        vec3 h = normalize(l-rd);

        float diffuse = clamp(dot(n, l), 0, 1) * softShadow(pos, l, 0.01, 3.0);
        float specular = pow(clamp(dot(h, n), 0, 1), 150) * diffuse;

        ret_color = (diffuse + specular) * vec3(1.00,0.70,0.5);
        // ret_color += diffuse + specular;
        // ret_color += softShadow(ro, rd, 0.01, 3.0);
        // vec3 mate = vec3(0.3);
        // ret_color = mate * 4.0*diffuse*vec3(1.00,0.70,0.5);
        // ret_color +=      12.0*specular*vec3(1.00,0.70,0.5);
    }

    return clamp(ret_color, 0, 1);
}

// ----------------------------------------------------

mat3 setCamera( in vec3 ro, in vec3 ta, float cr ){
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

// ----------------------------------------------------

void main(){
    vec2 uv = (gl_FragCoord.xy - .5 * passedInfo.res.xy) / passedInfo.res.y;
    vec3 col = vec3(0.);

    vec3 ro = vec3(3*sin(0.3*passedInfo.time),
                   -2 + 0.3*sin(0.1*passedInfo.time),
                   3*cos(0.3*passedInfo.time));
    // vec3 ro = vec3(-1, -1, -2);
    vec3 ta = vec3(0, -0.25, 0);
    // vec3 ta = vec3(passedInfo.time, -0.25, 0);
    mat3 camRot = setCamera( ro, ta, 0.0 );
    vec3 rd = camRot * normalize(vec3(uv.x, uv.y, 1));

    col = render(ro, rd);

    // float dScene = castRay(ro, rd);
    // vec3 p = ro + dScene * rd;
    // col = phongShading(p, rd);
    // col = naiveShading(p, rd);
    // col = getNormal(p);
    // col = vec3(dScene) / 20.0;
    outColor = vec4(col.xyz, 1.);
}