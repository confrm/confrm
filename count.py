import struct

with open("blob.bin", "wb") as fp:
    for i in range(0, 5000):
        val = i
        if i == 1000:
            val = 1001
        fp.write(struct.pack("=L", val))
