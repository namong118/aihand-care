import { describe, it, expect } from 'vitest';
import * as P from './protocol.js';

describe('명령 만들기', () => {
  it('모든 명령은 줄바꿈으로 끝난다', () => {
    expect(P.hello()).toBe('HELLO\n');
    expect(P.pose('ROCK')).toBe('POSE,ROCK\n');
    expect(P.react('ok')).toBe('REACT,OK\n');
    expect(P.react('retry')).toBe('REACT,RETRY\n');
    expect(P.rest()).toBe('REST\n');
    expect(P.speed('SLOW')).toBe('SPEED,SLOW\n');
    expect(P.speed('NORMAL')).toBe('SPEED,NORMAL\n');
    expect(P.ping()).toBe('PING\n');
  });

  it('잘못된 값은 에러', () => {
    expect(() => P.pose('rock')).toThrow();
    expect(() => P.pose('RO,CK')).toThrow();
    expect(() => P.pose('')).toThrow();
    expect(() => P.react('OK')).toThrow();
    expect(() => P.speed('FAST')).toThrow();
  });
});

describe('cam (WonderCam 모드, 펌웨어 F2·F3·F4)', () => {
  it('CAM,TAG · CAM,NUM · CAM,FACE 를 만든다', () => {
    expect(P.cam('TAG')).toBe('CAM,TAG\n');
    expect(P.cam('NUM')).toBe('CAM,NUM\n');
    expect(P.cam('FACE')).toBe('CAM,FACE\n');
    expect(P.cam('COLOR')).toBe('CAM,COLOR\n'); // 공 따라가기, 펌웨어 F5
  });
  it('그 밖의 모드는 바로 에러', () => {
    expect(() => P.cam('BALL')).toThrow();
    expect(() => P.cam('num')).toThrow();
  });
});

describe('track (공 따라가기, 펌웨어 F5)', () => {
  it('TRACK,ON / TRACK,OFF', () => {
    expect(P.track(true)).toBe('TRACK,ON\n');
    expect(P.track(false)).toBe('TRACK,OFF\n');
    expect(P.commandName(P.track(true))).toBe('TRACK');
  });
  it('DONE,TRACK 응답', () => {
    expect(P.parseLine('DONE,TRACK')).toEqual({ type: 'DONE', command: 'TRACK' });
  });
  it('BALL,NEAR (공이 손 가까이), RAW,BALL 측정 줄은 무시', () => {
    expect(P.parseLine('BALL,NEAR')).toEqual({ type: 'BALL', near: true });
    expect(P.parseLine('BALL,FAR').type).toBe('UNKNOWN');
    expect(P.parseLine('RAW,BALL,160,9000').type).toBe('UNKNOWN');
  });
});

describe('parseLine', () => {
  it('로봇 응답을 객체로 바꾼다', () => {
    expect(P.parseLine('DONE,POSE')).toEqual({ type: 'DONE', command: 'POSE' });
    expect(P.parseLine('DONE,HELLO\r\n')).toEqual({ type: 'DONE', command: 'HELLO' });
    expect(P.parseLine('TAG,3')).toEqual({ type: 'TAG', id: '3' });
    expect(P.parseLine('TAG,NONE')).toEqual({ type: 'TAG', id: null });
    expect(P.parseLine('NUM,3')).toEqual({ type: 'NUM', number: 3 });
    expect(P.parseLine('NUM,NONE')).toEqual({ type: 'NUM', number: null });
    expect(P.parseLine('PONG')).toEqual({ type: 'PONG' });
    expect(P.parseLine('ERR,UNKNOWN_POSE')).toEqual({ type: 'ERR', message: 'UNKNOWN_POSE' });
  });

  it('모르는 줄은 UNKNOWN', () => {
    expect(P.parseLine('HELLO')).toEqual({ type: 'UNKNOWN', raw: 'HELLO' });
    expect(P.parseLine('DONE')).toEqual({ type: 'UNKNOWN', raw: 'DONE' });
    expect(P.parseLine('')).toEqual({ type: 'UNKNOWN', raw: '' });
  });

  it('숫자 카드는 1~5 만. 그 밖과 RAW 측정 줄은 UNKNOWN (웹은 무시)', () => {
    expect(P.parseLine('NUM,0').type).toBe('UNKNOWN');
    expect(P.parseLine('NUM,6').type).toBe('UNKNOWN');
    expect(P.parseLine('NUM,12').type).toBe('UNKNOWN');
    expect(P.parseLine('NUM').type).toBe('UNKNOWN');
    expect(P.parseLine('RAW,NUM,3,87')).toEqual({ type: 'UNKNOWN', raw: 'RAW,NUM,3,87' });
  });

  it('얼굴: 번호는 숫자로, UNKNOWN 은 \'unknown\', NONE 은 null (펌웨어 F4)', () => {
    expect(P.parseLine('FACE,1')).toEqual({ type: 'FACE', faceId: 1 });
    expect(P.parseLine('FACE,5\r\n')).toEqual({ type: 'FACE', faceId: 5 });
    expect(P.parseLine('FACE,UNKNOWN')).toEqual({ type: 'FACE', faceId: 'unknown' });
    expect(P.parseLine('FACE,NONE')).toEqual({ type: 'FACE', faceId: null });
  });

  it('얼굴 번호가 아닌 값은 UNKNOWN (0, 음수, 글자, 값 없음)', () => {
    expect(P.parseLine('FACE,0').type).toBe('UNKNOWN');
    expect(P.parseLine('FACE,-1').type).toBe('UNKNOWN');
    expect(P.parseLine('FACE,U').type).toBe('UNKNOWN');
    expect(P.parseLine('FACE,100').type).toBe('UNKNOWN');
    expect(P.parseLine('FACE').type).toBe('UNKNOWN');
  });

  it('commandName 은 보낸 명령의 이름만 꺼낸다', () => {
    expect(P.commandName('POSE,ROCK\n')).toBe('POSE');
    expect(P.commandName('REST\n')).toBe('REST');
  });
});
