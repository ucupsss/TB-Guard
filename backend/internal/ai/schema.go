package ai

import (
	_ "embed"
	"encoding/json"
	"strings"
)

//go:embed tools.json
var toolsJSON []byte

type toolDef struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

// geminiFunctions dan groqTools dihitung sekali saat start, bukan per request.
var (
	geminiFunctions []map[string]any
	groqTools       []map[string]any
)

func init() {
	var tools []toolDef
	if err := json.Unmarshal(toolsJSON, &tools); err != nil {
		panic("tools.json rusak: " + err.Error())
	}
	for _, t := range tools {
		geminiFunctions = append(geminiFunctions, map[string]any{
			"name": t.Name, "description": t.Description, "parameters": cleanSchema(t.Parameters, true),
		})
		groqTools = append(groqTools, map[string]any{
			"type": "function",
			"function": map[string]any{
				"name": t.Name, "description": t.Description, "parameters": cleanSchema(t.Parameters, false),
			},
		})
	}
}

// cleanSchema menormalkan JSON Schema: Gemini butuh tipe huruf besar (+nullable), OpenAI/Groq huruf kecil.
func cleanSchema(v any, gemini bool) map[string]any {
	in, ok := v.(map[string]any)
	if !ok {
		return map[string]any{}
	}
	out := map[string]any{}
	for k, val := range in {
		switch k {
		case "type":
			var types []string
			switch t := val.(type) {
			case []any:
				for _, x := range t {
					types = append(types, strings.ToLower(asString(x)))
				}
			default:
				types = []string{strings.ToLower(asString(t))}
			}
			main, nullable := "string", false
			for _, t := range types {
				if t == "null" {
					nullable = true
				} else {
					main = t
					break
				}
			}
			if gemini {
				out["type"] = strings.ToUpper(main)
				if nullable {
					out["nullable"] = true
				}
			} else {
				out["type"] = main
			}
		case "properties":
			props := map[string]any{}
			if m, ok := val.(map[string]any); ok {
				for name, p := range m {
					props[name] = cleanSchema(p, gemini)
				}
			}
			out["properties"] = props
		case "items":
			out["items"] = cleanSchema(val, gemini)
		case "enum":
			if !gemini {
				out[k] = val
				break
			}
			var kept []string
			if arr, ok := val.([]any); ok {
				for _, x := range arr {
					if s := asString(x); strings.TrimSpace(s) != "" {
						kept = append(kept, s)
					}
				}
			}
			if len(kept) > 0 {
				out["enum"] = kept
			}
		default:
			out[k] = val
		}
	}
	// Gemini hanya menerima enum pada tipe STRING
	if gemini && out["type"] != "STRING" {
		delete(out, "enum")
	}
	return out
}

func asString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case nil:
		return ""
	default:
		b, _ := json.Marshal(t)
		return string(b)
	}
}
