import * as THREE from '../vendor/three.module.js';
const rotation=new THREE.Quaternion(),euler=new THREE.Euler();
// Express model-space anatomical rotations in each joint's rest-local frame.
export function bindPoseFrame(entry,modelWorld){
 entry.poseFrame=entry.bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(modelWorld).normalize();
 entry.poseFrameInverse=entry.poseFrame.clone().invert();
}
export function rigPose(entry,x,y,z,out){
 rotation.setFromEuler(euler.set(x,y,z));
 return out.copy(entry.rest).multiply(entry.poseFrame).multiply(rotation).multiply(entry.poseFrameInverse).normalize();
}

