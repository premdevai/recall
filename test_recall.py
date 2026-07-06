from recall import render

def test_render_groups_by_category():
    items = [
        {"category": "Performance", "title": "Virtualized table",
         "situation": "s", "task": "t", "action": "a", "result": "r",
         "resume_bullet": "b", "confidence": 95, "evidence": ["abc123"]},
        {"category": "Performance", "title": "Bundle split", "confidence": 80, "evidence": []},
    ]
    md = render(items)
    assert md.count("## Performance") == 1          # one heading per category
    assert "Virtualized table" in md and "Bundle split" in md
    assert "abc123" in md                            # evidence rendered
    print("ok")

if __name__ == "__main__":
    test_render_groups_by_category()
