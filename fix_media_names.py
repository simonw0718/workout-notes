#!/usr/bin/env python3
import os
import re

MEDIA_DIR = "public/hiit/media"

def to_slug(filename):
    """Convert filename to lowercase slug format (matching getSlugFromLabel logic)"""
    # Get name without extension
    name, ext = os.path.splitext(filename)
    
    # Convert to lowercase, remove apostrophes, replace non-alphanumeric with hyphens
    slug = name.lower()
    slug = slug.replace("'", "").replace("'", "")
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    
    return slug + ext

def main():
    if not os.path.exists(MEDIA_DIR):
        print(f"❌ Directory not found: {MEDIA_DIR}")
        return
    
    files = os.listdir(MEDIA_DIR)
    renamed_count = 0
    
    for filename in files:
        if filename.startswith('.'):
            continue
            
        old_path = os.path.join(MEDIA_DIR, filename)
        
        if not os.path.isfile(old_path):
            continue
        
        new_filename = to_slug(filename)
        new_path = os.path.join(MEDIA_DIR, new_filename)
        
        if filename != new_filename:
            if os.path.exists(new_path):
                print(f"⚠️  Target exists, skipping: {filename} -> {new_filename}")
                continue
            
            os.rename(old_path, new_path)
            print(f"✅ {filename} -> {new_filename}")
            renamed_count += 1
    
    print(f"\n🎉 Renamed {renamed_count} files")

if __name__ == "__main__":
    main()
