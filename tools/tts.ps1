param([string]$Json, [string]$OutDir)
Add-Type -AssemblyName System.Speech
$segs = Get-Content -Raw -Encoding UTF8 $Json | ConvertFrom-Json
foreach ($s in $segs) {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.SelectVoice('Microsoft Zira Desktop')
  $synth.Rate = 1
  $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $synth.SetOutputToWaveFile((Join-Path $OutDir ($s.id + '.wav')), $fmt)
  $synth.Speak($s.text)
  $synth.Dispose()
}
