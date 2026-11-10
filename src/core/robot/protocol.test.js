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

describe('cam (WonderCam 모드, 펌웨어 F2·F3)', () => {
  it('CAM,TAG 와 CAM,NUM 을 만든다', () => {
    expect(P.cam('TAG')).toBe('CAM,TAG\n');
    expect(P.cam('NUM')).toBe('CAM,NUM\n');
  });
  it('그 밖의 모드는 바로 에러', () => {
    expect(() => P.cam('COLOR')).toThrow();
    expect(() => P.cam('num')).toThrow();
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

  it('commandName 은 보낸 명령의 이름만 꺼낸다', () => {
    expect(P.commandName('POSE,ROCK\n')).toBe('POSE');
    expect(P.commandName('REST\n')).toBe('REST');
  });
});
