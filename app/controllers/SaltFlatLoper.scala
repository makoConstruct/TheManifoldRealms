package controllers
import java.nio._
import util.Random
trait Hasher{
	def hash(l:Long):Long
}
class SaltFlatLoper(secret:Long, flatSize:Int = 821, lopelevel:Int = 7) extends Hasher{
	//An absurdly efficient hash that works by reusing work done at initialization time.
	//I do not claim that this hash cannot be reversed, and I have a few simple things in mind that I could do to improve it. Thing is, I'm not sure I fear a curious player stealing a place in olympus more than I'd appreciate the associated schooling.
	private val byteTable = ByteBuffer.allocate(flatSize*8)
	new Random(secret).nextBytes(byteTable.array)
	private val table = new Array[Long](flatSize)
	byteTable.asLongBuffer.get(table)
	def mongle(l:Long) = (l*6364136223846793005l) + 1442695040888963407l //Thank you Knuth, for these blessed linear congruential generator parameters.
	private def at(l:Long):Long = table((l.abs%flatSize).toInt)
	def hash(l:Long):Long ={
		def gather(i:Int, acc:Long):Long =
			if(i == 0)
				acc
			else
				gather(i - 1, acc ^ at(mongle(acc + i)))
		gather(lopelevel, l)
	}
	def apply(v:Long) = hash(v)
}