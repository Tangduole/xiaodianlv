#!/usr/bin/env python3
"""
ASR 转录脚本 - Faster Whisper 本地转录
"""

import json
import argparse
from faster_whisper import WhisperModel

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('audio_path', help='音频文件路径')
    parser.add_argument('--model', default='base', help='模型大小: tiny/base/small/medium/large-v3')
    parser.add_argument('--language', default='zh', help='语言代码')
    args = parser.parse_args()

    # 加载模型
    model = WhisperModel(args.model, device="auto", compute_type="default")
    
    # 转录
    segments, info = model.transcribe(
        args.audio_path,
        language=args.language,
        vad_filter=True
    )

    # 拼接文本
    text = ''.join([segment.text for segment in segments]).strip()
    
    # 输出 JSON
    result = {
        'text': text,
        'language': info.language,
        'duration': info.duration
    }
    
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
