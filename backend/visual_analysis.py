"""
visual_analysis.py — Visual Analysis Module
============================================
Python 3.11 compatible.
Runs MediaPipe FaceMesh + Pose + YOLOv8 on video frames.

Detects:
  - Blink rate (EAR)
  - Iris tracking / eye contact breaks
  - Head movement
  - Posture (shoulder alignment)
  - Arms crossed
  - Slouch
  - Phone detection (YOLO class 67)
  - Multiple people (YOLO class 0 + FaceMesh)

Flag types:
  PHONE_DETECTED, MULTIPLE_PEOPLE, EYE_CONTACT_BREAK,
  ARMS_CROSSED, POOR_POSTURE_SUSTAINED, EXCESSIVE_HEAD_MOVEMENT
"""

from __future__ import annotations
import os
import uuid
from typing import List, Dict, Any, Optional

import cv2
import mediapipe as mp
import numpy as np

# YOLOv8
_yolo_model = None
def _get_yolo():
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        _yolo_model = YOLO("yolov8n.pt")
    return _yolo_model

# Constants
BLINK_EAR_THRESHOLD       = 0.21
BLINK_CONSEC_FRAMES       = 3
BLINK_RATE_MAX            = 21
HEAD_OFFSET_THRESHOLD     = 25
POSTURE_DELTA_MAX         = 0.10
PHONE_CLASS_ID            = 67
PERSON_CLASS_ID           = 0
PHONE_CONF_THRESHOLD      = 0.40
PERSON_CONF_THRESHOLD     = 0.45
FRAME_INTERVAL            = 3
YOLO_INTERVAL             = 8
RESIZE_W, RESIZE_H        = 640, 360
IRIS_DEVIATION_THRESHOLD  = 0.30
EYE_CONTACT_CONSEC_FRAMES = 5
ARMS_CROSSED_RATIO        = 0.50
SLOUCH_THRESHOLD          = 0.08
SLOUCH_FRAME_RATIO        = 0.40

# Landmark indices
_LEFT_EYE   = [362, 385, 387, 263, 373, 380]
_RIGHT_EYE  = [33,  160, 158, 133, 153, 144]
_IRIS_LEFT  = 468
_IRIS_RIGHT = 473
_L_EYE_INNER, _L_EYE_OUTER = 133, 33
_R_EYE_INNER, _R_EYE_OUTER = 362, 263

_mp_pose = mp.solutions.pose

STATIC_FRAMES = "static/frames"
STATIC_POSES  = "static/poses"
STATIC_BLINKS = "static/blinks"
for d in [STATIC_FRAMES, STATIC_POSES, STATIC_BLINKS]:
    os.makedirs(d, exist_ok=True)


def _ear(landmarks, indices: List[int], w: int, h: int) -> float:
    pts = [(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in indices]
    v1  = np.linalg.norm(np.array(pts[1]) - np.array(pts[5]))
    v2  = np.linalg.norm(np.array(pts[2]) - np.array(pts[4]))
    hz  = np.linalg.norm(np.array(pts[0]) - np.array(pts[3]))
    return (v1 + v2) / (2.0 * hz + 1e-6)


def _iris_deviation(landmarks, w: int, h: int) -> float:
    def _dev(iris_idx, inner_idx, outer_idx):
        iris   = landmarks[iris_idx]
        inner  = landmarks[inner_idx]
        outer  = landmarks[outer_idx]
        eye_w  = abs(outer.x - inner.x) + 1e-6
        centre = (inner.x + outer.x) / 2
        return abs(iris.x - centre) / eye_w
    left_dev  = _dev(_IRIS_LEFT,  _L_EYE_INNER, _L_EYE_OUTER)
    right_dev = _dev(_IRIS_RIGHT, _R_EYE_INNER, _R_EYE_OUTER)
    return max(left_dev, right_dev)


def _is_head_moving(landmarks, w: int, h: int) -> bool:
    nose   = landmarks[1]
    le     = landmarks[133]
    re     = landmarks[362]
    mid_x  = ((le.x + re.x) / 2) * w
    nose_x = nose.x * w
    return abs(nose_x - mid_x) > HEAD_OFFSET_THRESHOLD


def _arms_crossed(pose_lm) -> bool:
    lw    = pose_lm[_mp_pose.PoseLandmark.LEFT_WRIST]
    rw    = pose_lm[_mp_pose.PoseLandmark.RIGHT_WRIST]
    ls    = pose_lm[_mp_pose.PoseLandmark.LEFT_SHOULDER]
    rs    = pose_lm[_mp_pose.PoseLandmark.RIGHT_SHOULDER]
    mid_x = (ls.x + rs.x) / 2
    return lw.x > mid_x and rw.x < mid_x


def _is_slouching(pose_lm) -> bool:
    ls = pose_lm[_mp_pose.PoseLandmark.LEFT_SHOULDER]
    rs = pose_lm[_mp_pose.PoseLandmark.RIGHT_SHOULDER]
    lh = pose_lm[_mp_pose.PoseLandmark.LEFT_HIP]
    rh = pose_lm[_mp_pose.PoseLandmark.RIGHT_HIP]
    avg_shoulder_y = (ls.y + rs.y) / 2
    avg_hip_y      = (lh.y + rh.y) / 2
    return (avg_hip_y - avg_shoulder_y) < SLOUCH_THRESHOLD


def _save_frame(frame, directory: str, prefix: str, captures: List[str]) -> None:
    fname = f"{directory}/{prefix}_{uuid.uuid4().hex[:8]}.jpg"
    cv2.imwrite(fname, frame)
    captures.append(f"/{fname}")


def _zero_result(error: Optional[str] = None) -> Dict[str, Any]:
    return {
        "blink_count": 0, "blink_rate": 0.0, "blink_score": 0,
        "posture_score": 0, "head_movement_pct": 0.0,
        "phone_detected": False, "frame_captures": [],
        "visual_score": 0, "frames_analysed": 0, "error": error,
        "eye_contact_breaks": 0, "avg_iris_deviation": 0.0,
        "multiple_people": False, "arms_crossed_pct": 0.0,
        "slouch_pct": 0.0, "flags": [],
    }


def analyse_visual(video_path: str) -> Dict[str, Any]:
    """Run all visual analysis on a video file."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return _zero_result(error=f"Cannot open video: {video_path}")

    fps       = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_idx = 0

    blink_count            = 0
    consec_below           = 0
    frames_moving          = 0
    frames_with_face       = 0
    posture_good_count     = 0
    posture_total          = 0
    phone_detected         = False
    multiple_people_frames = 0
    arms_crossed_count     = 0
    slouch_count           = 0
    pose_total             = 0
    iris_break_consec      = 0
    eye_contact_breaks     = 0
    iris_deviations: List[float] = []
    flags: List[Dict[str, Any]] = []
    frame_captures: List[str]   = []

    yolo    = _get_yolo()
    mp_face = mp.solutions.face_mesh
    mp_pose = mp.solutions.pose

    try:
        with mp_face.FaceMesh(
            max_num_faces=2,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as face_mesh, mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as pose_model:

            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frame_idx += 1
                frame = cv2.resize(frame, (RESIZE_W, RESIZE_H))
                h, w  = frame.shape[:2]

                if frame_idx % FRAME_INTERVAL != 0:
                    continue

                rgb          = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                timestamp_s  = round(frame_idx / fps, 2)

                # FaceMesh
                face_res = face_mesh.process(rgb)
                if face_res.multi_face_landmarks:
                    if len(face_res.multi_face_landmarks) > 1:
                        multiple_people_frames += 1
                        if multiple_people_frames == 3:
                            flags.append({
                                "type": "MULTIPLE_PEOPLE",
                                "frame": frame_idx,
                                "timestamp_s": timestamp_s,
                                "detail": "More than one face detected",
                            })

                    lm = face_res.multi_face_landmarks[0].landmark
                    frames_with_face += 1

                    avg_ear = (_ear(lm, _LEFT_EYE, w, h) + _ear(lm, _RIGHT_EYE, w, h)) / 2
                    if avg_ear < BLINK_EAR_THRESHOLD:
                        consec_below += 1
                    else:
                        if consec_below >= BLINK_CONSEC_FRAMES:
                            blink_count += 1
                            _save_frame(frame, STATIC_BLINKS, "blink", frame_captures)
                        consec_below = 0

                    if _is_head_moving(lm, w, h):
                        frames_moving += 1

                    try:
                        dev = _iris_deviation(lm, w, h)
                        iris_deviations.append(dev)
                        if dev > IRIS_DEVIATION_THRESHOLD:
                            iris_break_consec += 1
                            if iris_break_consec == EYE_CONTACT_CONSEC_FRAMES:
                                eye_contact_breaks += 1
                                flags.append({
                                    "type": "EYE_CONTACT_BREAK",
                                    "frame": frame_idx,
                                    "timestamp_s": timestamp_s,
                                    "detail": f"Iris deviation {dev:.2f} sustained for 5 frames",
                                })
                        else:
                            iris_break_consec = 0
                    except (IndexError, AttributeError):
                        pass

                # Pose
                pose_res = pose_model.process(rgb)
                if pose_res.pose_landmarks:
                    lm_p = pose_res.pose_landmarks.landmark
                    posture_total += 1
                    pose_total    += 1

                    ls = lm_p[_mp_pose.PoseLandmark.LEFT_SHOULDER]
                    rs = lm_p[_mp_pose.PoseLandmark.RIGHT_SHOULDER]
                    if abs(ls.y - rs.y) <= POSTURE_DELTA_MAX:
                        posture_good_count += 1

                    if _arms_crossed(lm_p):
                        arms_crossed_count += 1
                    if _is_slouching(lm_p):
                        slouch_count += 1

                # YOLO
                if frame_idx % YOLO_INTERVAL == 0:
                    detections   = yolo(rgb, verbose=False)[0].boxes
                    person_count = 0
                    for det in detections:
                        cls  = int(det.cls.item())
                        conf = det.conf.item()
                        if cls == PHONE_CLASS_ID and conf > PHONE_CONF_THRESHOLD and not phone_detected:
                            phone_detected = True
                            flags.append({
                                "type": "PHONE_DETECTED",
                                "frame": frame_idx,
                                "timestamp_s": timestamp_s,
                                "detail": f"Cell phone detected (conf {conf:.0%})",
                            })
                            _save_frame(frame, STATIC_FRAMES, "phone", frame_captures)
                        if cls == PERSON_CLASS_ID and conf > PERSON_CONF_THRESHOLD:
                            person_count += 1
                    if person_count > 1:
                        multiple_people_frames += 1
                        if multiple_people_frames == 3 and not any(
                            f["type"] == "MULTIPLE_PEOPLE" for f in flags
                        ):
                            flags.append({
                                "type": "MULTIPLE_PEOPLE",
                                "frame": frame_idx,
                                "timestamp_s": timestamp_s,
                                "detail": f"{person_count} persons detected by YOLO",
                            })

    except Exception as e:
        cap.release()
        return _zero_result(error=str(e))

    cap.release()

    frames_processed  = frame_idx // FRAME_INTERVAL
    duration_seconds  = (frames_processed * FRAME_INTERVAL) / fps
    blinks_per_min    = blink_count / max(duration_seconds / 60, 0.01)
    head_movement_pct = round((frames_moving / max(frames_with_face, 1)) * 100, 1)

    blink_score   = 1 if blinks_per_min <= BLINK_RATE_MAX else 0
    posture_score = 1 if (
        posture_total > 0 and posture_good_count / posture_total >= 0.70
    ) else 0

    arms_crossed_pct = round((arms_crossed_count / max(pose_total, 1)) * 100, 1)
    slouch_pct       = round((slouch_count / max(pose_total, 1)) * 100, 1)
    avg_iris_dev     = round(float(np.mean(iris_deviations)) if iris_deviations else 0.0, 3)

    if pose_total > 0 and arms_crossed_count / pose_total >= ARMS_CROSSED_RATIO:
        flags.append({
            "type": "ARMS_CROSSED",
            "frame": -1, "timestamp_s": -1,
            "detail": f"Arms crossed in {arms_crossed_pct}% of pose frames",
        })
    if pose_total > 0 and slouch_count / pose_total >= SLOUCH_FRAME_RATIO:
        flags.append({
            "type": "POOR_POSTURE_SUSTAINED",
            "frame": -1, "timestamp_s": -1,
            "detail": f"Slouching in {slouch_pct}% of frames",
        })
    if frames_with_face > 0 and frames_moving / frames_with_face > 0.40:
        flags.append({
            "type": "EXCESSIVE_HEAD_MOVEMENT",
            "frame": -1, "timestamp_s": -1,
            "detail": f"Head turned away in {head_movement_pct}% of frames",
        })

    return {
        "blink_count":       blink_count,
        "blink_rate":        round(blinks_per_min, 1),
        "blink_score":       blink_score,
        "posture_score":     posture_score,
        "head_movement_pct": head_movement_pct,
        "phone_detected":    phone_detected,
        "frame_captures":    frame_captures,
        "visual_score":      blink_score + posture_score,
        "frames_analysed":   frames_processed,
        "error":             None,
        "eye_contact_breaks": eye_contact_breaks,
        "avg_iris_deviation": avg_iris_dev,
        "multiple_people":   multiple_people_frames >= 3,
        "arms_crossed_pct":  arms_crossed_pct,
        "slouch_pct":        slouch_pct,
        "flags":             flags,
    }


# Live frame analysis for WebSocket
_live_face_mesh = None
_live_pose      = None

def _get_live_models():
    global _live_face_mesh, _live_pose
    if _live_face_mesh is None:
        _live_face_mesh = mp.solutions.face_mesh.FaceMesh(
            max_num_faces=2, refine_landmarks=True,
            min_detection_confidence=0.5, min_tracking_confidence=0.5,
        ).__enter__()
    if _live_pose is None:
        _live_pose = mp.solutions.pose.Pose(
            min_detection_confidence=0.5, min_tracking_confidence=0.5,
        ).__enter__()
    return _live_face_mesh, _live_pose


def analyse_frame(frame_bytes: bytes) -> Dict[str, Any]:
    """Analyse a single JPEG frame for live WebSocket streaming."""
    try:
        arr   = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"error": "Could not decode frame"}

        frame = cv2.resize(frame, (RESIZE_W, RESIZE_H))
        h, w  = frame.shape[:2]
        rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        face_mesh, pose_model = _get_live_models()
        yolo = _get_yolo()

        result: Dict[str, Any] = {
            "face_detected":  False,
            "ear":            0.0,
            "iris_deviation": 0.0,
            "head_moving":    False,
            "multiple_faces": False,
            "person_count":   0,
            "phone_detected": False,
            "arms_crossed":   False,
            "slouching":      False,
            "flags":          [],
        }

        face_res = face_mesh.process(rgb)
        if face_res.multi_face_landmarks:
            result["face_detected"]  = True
            result["multiple_faces"] = len(face_res.multi_face_landmarks) > 1
            lm = face_res.multi_face_landmarks[0].landmark

            avg_ear = (_ear(lm, _LEFT_EYE, w, h) + _ear(lm, _RIGHT_EYE, w, h)) / 2
            result["ear"]         = round(avg_ear, 3)
            result["head_moving"] = _is_head_moving(lm, w, h)

            try:
                dev = _iris_deviation(lm, w, h)
                result["iris_deviation"] = round(dev, 3)
                if dev > IRIS_DEVIATION_THRESHOLD:
                    result["flags"].append("EYE_CONTACT_BREAK")
            except (IndexError, AttributeError):
                pass

            if result["multiple_faces"]:
                result["flags"].append("MULTIPLE_PEOPLE")
            if result["head_moving"]:
                result["flags"].append("HEAD_TURNED")

        pose_res = pose_model.process(rgb)
        if pose_res.pose_landmarks:
            lm_p = pose_res.pose_landmarks.landmark
            if _arms_crossed(lm_p):
                result["arms_crossed"] = True
                result["flags"].append("ARMS_CROSSED")
            if _is_slouching(lm_p):
                result["slouching"] = True
                result["flags"].append("POOR_POSTURE")

        detections   = yolo(rgb, verbose=False)[0].boxes
        person_count = 0
        for det in detections:
            cls  = int(det.cls.item())
            conf = det.conf.item()
            if cls == PHONE_CLASS_ID and conf > PHONE_CONF_THRESHOLD:
                result["phone_detected"] = True
                if "PHONE_DETECTED" not in result["flags"]:
                    result["flags"].append("PHONE_DETECTED")
            if cls == PERSON_CLASS_ID and conf > PERSON_CONF_THRESHOLD:
                person_count += 1

        result["person_count"] = person_count
        if person_count > 1 and "MULTIPLE_PEOPLE" not in result["flags"]:
            result["flags"].append("MULTIPLE_PEOPLE")

        return result

    except Exception as exc:
        return {"error": str(exc)}
