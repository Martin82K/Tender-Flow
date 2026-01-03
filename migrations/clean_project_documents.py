import re

file_path = '/Users/martin/CRM/CRM/components/projectLayoutComponents/ProjectDocuments.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

print("Step 1: Removing DocHub dead code (v2)...")

marker1 = "setIsEditingPriceList(false);"
idx1 = content.find(marker1)
start_pos = -1

if idx1 != -1:
    end_brace_idx = content.find("};", idx1)
    if end_brace_idx != -1:
         start_pos = end_brace_idx + 2
    else:
         print("End brace for handleSavePriceList not found")

end_marker = "const handleSaveLetter = async () => {"
end_pos = content.find(end_marker)

if start_pos != -1 and end_pos != -1:
    print(f"Deleting content from {start_pos} to {end_pos}...")
    content = content[:start_pos] + "\n\n    " + content[end_pos:]
else:
    print("Markers not found.")

# Remove import invocations if unused
content = content.replace("import { supabase } from '../../services/supabase';", "// supabase import removed")
content = content.replace("import { invokeAuthedFunction } from '../../services/functionsClient';", "// invokeAuthedFunction import removed")

print("Saving...")
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done.")
