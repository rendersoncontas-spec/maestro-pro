import os
import sys

def convert_icon(size):
    input_path = f"icons/icon-{size}.svg"
    output_path = f"icons/icon-{size}.png"
    
    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        return False
        
    try:
        import cairosvg
        print(f"Converting {input_path} to {output_path}...")
        cairosvg.svg2png(url=input_path, write_to=output_path, output_width=size, output_height=size)
        print("Success.")
        return True
    except Exception as e:
        print(f"Failed to convert {input_path}: {e}")
        return False

def main():
    success_192 = convert_icon(192)
    success_512 = convert_icon(512)
    
    if success_192 and success_512:
        try:
            os.remove("icons/icon-192.svg")
            os.remove("icons/icon-512.svg")
            print("Successfully deleted old SVGs.")
        except Exception as e:
            print(f"Failed to delete SVGs: {e}")
    else:
        print("Conversion failed. Did not delete SVGs.")

if __name__ == "__main__":
    main()
