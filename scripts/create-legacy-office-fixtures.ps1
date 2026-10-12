$ErrorActionPreference = 'Stop'
$fixtureDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../test-results/fixtures'))
$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3
    $document = $word.Documents.Add()
    $document.Content.Text = "旧版 Word 中文标题`r第一段中文内容，保留全部字符。`r第二段 UTF-16 文本。"
    $document.SaveAs2((Join-Path $fixtureDirectory 'legacy.doc'), 0)
} finally {
    if ($null -ne $document) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) }
    if ($null -ne $word) { $word.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }
}
$powerpoint = $null
$deck = $null
try {
    $powerpoint = New-Object -ComObject PowerPoint.Application
    $powerpoint.AutomationSecurity = 3
    $deck = $powerpoint.Presentations.Add(0)
    foreach ($index in 1..2) {
        $slide = $deck.Slides.Add($index, 1)
        $slide.Shapes.Title.TextFrame.TextRange.Text = "旧版 PowerPoint 中文标题 $index"
        $slide.Shapes.Item(2).TextFrame.TextRange.Text = "第 $index 页完整正文"
    }
    $deck.SaveAs((Join-Path $fixtureDirectory 'legacy.ppt'), 1)
} finally {
    if ($null -ne $deck) { $deck.Close(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($deck) }
    if ($null -ne $powerpoint) {
        if ($powerpoint.Presentations.Count -eq 0) { $powerpoint.Quit() }
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($powerpoint)
    }
}
